import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';

import { isSupabaseConfigured } from '@/lib/env';
import { hasSessionCookie } from '@/lib/auth/session-cookie';
import { createClient } from '@/lib/supabase/server';

import { ALL_PERMISSIONS, branchesWith, type AppPermission, type StaffBranch, type StaffContext } from './permissions';

const contextSchema = z.object({
  user_id: z.string(),
  role: z.enum(['owner', 'staff']),
  display_name: z.string(),
  employee_id: z.string().nullable(),
  is_active: z.boolean(),
  must_change_password: z.boolean(),
  branches: z.array(
    z.object({
      branch_id: z.string(),
      name: z.string(),
      slug: z.string(),
      permissions: z.array(z.enum(ALL_PERMISSIONS)),
    }),
  ),
});

/** Người dùng hiện tại (đã xác thực JWT). Gọi nhiều lần trong 1 request chỉ chạy 1 lần. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === 'string' ? sub : null;
});

/**
 * Vai trò + quyền HIỆU LỰC theo chi nhánh, tính bởi database (cùng hàm RLS dùng).
 * null = chưa đăng nhập hoặc không phải tài khoản nhân sự.
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  // Không gọi getClaims trước (tốn thêm 1 lượt mạng): RPC chạy bằng JWT trong cookie, PostgREST tự
  // xác minh chữ ký + hạn; JWT sai/hết hạn → lỗi → null. Proxy đã làm mới phiên trước khi render.
  if (!isSupabaseConfigured() || !(await hasSessionCookie())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_staff_context');
  if (error || data === null) return null;
  const parsed = contextSchema.safeParse(data);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    userId: c.user_id,
    role: c.role,
    displayName: c.display_name,
    employeeId: c.employee_id,
    isActive: c.is_active,
    mustChangePassword: c.must_change_password,
    branches: c.branches.map((b) => ({
      branchId: b.branch_id,
      name: b.name,
      slug: b.slug,
      permissions: b.permissions,
    })),
  };
});

export const ACTIVE_BRANCH_COOKIE = 'rally_branch';

/** Chi nhánh đang làm việc (cookie), rơi về chi nhánh đầu tiên có quyền. */
export async function getActiveBranch(ctx: StaffContext, permission?: AppPermission): Promise<StaffBranch | null> {
  const candidates = branchesWith(ctx, permission);
  if (candidates.length === 0) return null;
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
  return candidates.find((b) => b.branchId === preferred) ?? candidates[0] ?? null;
}
