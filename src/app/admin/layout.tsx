import { type Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { ToastProvider } from '@/components/ui/toast';
import { AdminShell } from '@/features/admin-shell/components/admin-shell';
import { parseClosedGroups } from '@/features/admin-shell/lib/ui-prefs';
import { buildNav, NAV_CLOSED_COOKIE, SIDEBAR_COOKIE } from '@/features/admin-shell/nav';
import { getActiveBranch, getStaffContext } from '@/lib/auth/context';

export const metadata: Metadata = {
  title: { default: 'Quản trị', template: '%s | Rally quản trị' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin-login');
  if (!ctx.isActive) redirect('/admin-login?error=inactive');
  const [active, cookieStore] = await Promise.all([getActiveBranch(ctx), cookies()]);
  return (
    <ToastProvider>
      <AdminShell
        nav={ctx.mustChangePassword ? [] : buildNav(ctx)}
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
