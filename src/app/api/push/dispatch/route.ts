import { NextResponse } from 'next/server';

import { dispatchPendingPush } from '@/features/push/send';
import { getStaffContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Rally Manager đang mở thấy lịch sân thay đổi → nhờ máy chủ gửi các thông báo đang chờ (vd. nhân viên khác vừa
 * xác nhận đơn). Chỉ tài khoản quản trị đang đăng nhập gọi được; không trả dữ liệu nào ngoài số đã gửi.
 */
export async function POST() {
  const ctx = await getStaffContext();
  if (!ctx?.isActive) return NextResponse.json({ ok: false }, { status: 401 });
  const sent = await dispatchPendingPush(1);
  return NextResponse.json({ ok: true, sent }, { headers: { 'Cache-Control': 'no-store' } });
}
