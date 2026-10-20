import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

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
 */
async function handle(request: NextRequest) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ ok: false, message: 'CRON_SECRET chưa cấu hình' }, { status: 503 });
  if (!authorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
  }
  try {
    const { data, error } = await createSecretClient().rpc('service_close_forgotten_shifts');
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, result: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
