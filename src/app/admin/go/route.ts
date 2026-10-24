import { NextResponse, type NextRequest } from 'next/server';

import { ACTIVE_BRANCH_COOKIE, getStaffContext } from '@/lib/auth/context';
import { isDateKey } from '@/lib/time';

/** Đích của thông báo đẩy — chỉ các trang cố định trong khu quản trị (không chuyển hướng ra ngoài). */
const DESTINATIONS: Record<string, (date: string | null) => string> = {
  bookings: (date) => (date ? `/admin/bookings?date=${date}` : '/admin/bookings'),
  bank: () => '/admin/bank',
  security: () => '/admin/security?tab=su-kien',
  checkout: () => '/admin/checkout',
};

/**
 * Bấm thông báo "Đơn online mới · Rally Quận 7" → chuyển sang đúng chi nhánh của đơn (nếu có quyền) rồi mở trang.
 * /admin/go?to=bookings&branch=<id>&date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const build = DESTINATIONS[params.get('to') ?? ''] ?? (() => '/admin');
  const date = params.get('date');
  const target = new URL(build(date && isDateKey(date) ? date : null), request.nextUrl.origin);
  const response = NextResponse.redirect(target);
  const branch = params.get('branch');
  const ctx = await getStaffContext();
  if (!ctx)
    return NextResponse.redirect(
      new URL(`/admin-login?next=${encodeURIComponent(target.pathname + target.search)}`, request.nextUrl.origin),
    );
  if (branch && ctx.branches.some((b) => b.branchId === branch)) {
    response.cookies.set(ACTIVE_BRANCH_COOKIE, branch, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 180 });
  }
  return response;
}
