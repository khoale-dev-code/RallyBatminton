import { type Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { ToastProvider } from '@/components/ui/toast';
import { AdminShell } from '@/features/admin-shell/components/admin-shell';
import { parseClosedGroups } from '@/features/admin-shell/lib/ui-prefs';
import { buildNav, NAV_CLOSED_COOKIE, SIDEBAR_COOKIE } from '@/features/admin-shell/nav';
import { getReviewCount } from '@/features/attendance/queries';
import { getDataRequestCounts } from '@/features/privacy/queries';
import { getActiveBranch, getStaffContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: { default: 'Quản trị', template: '%s | Rally quản trị' },
  robots: { index: false, follow: false },
};

/** Đề nghị tăng ca đang chờ chính nhân viên này trả lời (RLS: chỉ thấy của mình). Lỗi / chưa chạy SQL 18 → 0. */
async function countPendingOvertime(employeeId: string | null): Promise<number> {
  if (!employeeId) return 0;
  const supabase = await createClient();
  const now = Date.now();
  // Khung tăng ca dài nhất 8 giờ: chỉ cần xét ca kết thúc trong 8 giờ qua trở đi.
  const { data, error } = await supabase
    .from('shift_overtime')
    .select('minutes, shifts!inner(scheduled_end)')
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
    .gte('shifts.scheduled_end', new Date(now - 8 * 3_600_000).toISOString())
    .limit(20);
  if (error || !data) return 0;
  return data.filter((o) => o.shifts && new Date(o.shifts.scheduled_end).getTime() + o.minutes * 60_000 > now).length;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin-login');
  if (!ctx.isActive) redirect('/admin-login?error=inactive');
  const ownerReady = ctx.role === 'owner' && !ctx.mustChangePassword;
  const [active, cookieStore, pendingOvertime, attendanceReview, privacy] = await Promise.all([
    getActiveBranch(ctx),
    cookies(),
    countPendingOvertime(ctx.employeeId),
    // Chủ sân: số yêu cầu sửa giờ + ca ra trễ chờ duyệt (huy hiệu menu Duyệt chấm công).
    ownerReady ? getReviewCount() : Promise.resolve(0),
    // Chủ sân: yêu cầu về dữ liệu cá nhân đang mở (huy hiệu menu Dữ liệu cá nhân).
    ownerReady ? getDataRequestCounts() : Promise.resolve({ open: 0, overdue: 0, unacknowledged: 0 }),
  ]);
  return (
    <ToastProvider>
      <AdminShell
        nav={ctx.mustChangePassword ? [] : buildNav(ctx, { pendingOvertime, attendanceReview, privacyRequests: privacy.open })}
        displayName={ctx.displayName}
        roleLabel={ctx.role === 'owner' ? 'Chủ sân' : 'Nhân viên'}
        branches={ctx.mustChangePassword ? [] : ctx.branches.map((b) => ({ id: b.branchId, name: b.name }))}
        activeBranchId={active?.branchId ?? null}
        initialRail={cookieStore.get(SIDEBAR_COOKIE)?.value === 'rail'}
        initialClosedGroups={parseClosedGroups(cookieStore.get(NAV_CLOSED_COOKIE)?.value)}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
