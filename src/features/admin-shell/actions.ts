'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';

import { ACTIVE_BRANCH_COOKIE, getStaffContext } from '@/lib/auth/context';

/** Đổi chi nhánh đang làm việc (chỉ lưu lựa chọn; quyền vẫn kiểm tra ở database). */
export async function setActiveBranchAction(branchId: string): Promise<void> {
  const ctx = await getStaffContext();
  if (!ctx?.branches.some((b) => b.branchId === branchId)) return;
  const store = await cookies();
  store.set(ACTIVE_BRANCH_COOKIE, branchId, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 180 });
  refresh();
}
