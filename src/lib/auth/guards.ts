import 'server-only';

import { redirect } from 'next/navigation';

import { getActiveBranch, getStaffContext } from './context';
import { hasPermission, type AppPermission, type StaffBranch, type StaffContext } from './permissions';

/** Trang quản trị: bắt buộc đăng nhập bằng tài khoản nhân sự đang hoạt động. */
export async function requireStaff(options: { allowPasswordChange?: boolean } = {}): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin-login');
  if (!ctx.isActive) redirect('/admin-login?error=inactive');
  if (ctx.mustChangePassword && !options.allowPasswordChange) redirect('/admin/password');
  return ctx;
}

export async function requireOwner(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (ctx.role !== 'owner') redirect('/admin/denied');
  return ctx;
}

/** Bắt buộc có quyền ở ít nhất một chi nhánh; trả về chi nhánh đang làm việc phù hợp. */
export async function requireBranchPermission(permission: AppPermission): Promise<{ ctx: StaffContext; branch: StaffBranch }> {
  const ctx = await requireStaff();
  const branch = await getActiveBranch(ctx, permission);
  if (!branch || !hasPermission(ctx, permission, branch.branchId)) redirect('/admin/denied');
  return { ctx, branch };
}
