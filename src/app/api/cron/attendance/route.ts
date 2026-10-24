import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { sendSecurityAlertsSafely } from '@/features/security/alerts';
import { getCronSecret } from '@/lib/env.server';
import { createSecretClient } from '@/lib/supabase/secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Hằng đêm (Vercel Cron, vercel.json): đóng các ca nhân viên quên quét ra đã quá hạn (đúng giờ kết thúc theo lịch)
 * và cho đề nghị tăng ca chưa trả lời hết hạn. Trang Duyệt chấm công / Bảng lương cũng tự chạy việc này khi mở.
 * Kèm theo: dọn dữ liệu cá nhân hết thời hạn lưu trữ (Quản trị → Dữ liệu cá nhân → Thời hạn lưu trữ),
 * dọn dấu vết chống lạm dụng cũ và gửi bù email cảnh báo bảo mật chưa gửi được (23_security_hardening.sql).
 */
async function handle(request: NextRequest) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ ok: false, message: 'CRON_SECRET chưa cấu hình' }, { status: 503 });
  if (!authorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createSecretClient();
    const [shifts, retention, security, push] = await Promise.all([
      supabase.rpc('service_close_forgotten_shifts'),
      // Cùng lịch hằng đêm: dọn dữ liệu cá nhân hết thời hạn lưu trữ (loại chủ sân bật "Tự động").
      supabase.rpc('service_apply_retention'),
      supabase.rpc('service_security_maintenance'),
      supabase.rpc('service_push_maintenance'),
    ]);
    if (security.error && security.error.code !== 'PGRST202') console.error('[cron] Bảo trì bảo mật lỗi:', security.error.message);
    if (push.error && push.error.code !== 'PGRST202') console.error('[cron] Dọn thông báo đẩy lỗi:', push.error.message);
    await sendSecurityAlertsSafely();
    if (shifts.error) return NextResponse.json({ ok: false, message: shifts.error.message }, { status: 502 });
    if (retention.error) console.error('[cron] Chưa dọn được dữ liệu hết hạn (đã chạy 22_privacy_security.sql?):', retention.error.message);
    return NextResponse.json(
      {
        ok: true,
        result: shifts.data,
        retention: retention.error ? null : retention.data,
        security: security.error ? null : security.data,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
