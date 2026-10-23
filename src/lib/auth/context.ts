import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';

import { isSupabaseConfigured } from '@/lib/env';
import { hasSessionCookie } from '@/lib/auth/session-cookie';
import { createClient } from '@/lib/supabase/server';

import { readCachedContext, tokenCacheKey, writeCachedContext } from './context-cache';
import { ALL_PERMISSIONS, branchesWith, type AppPermission, type StaffBranch, type StaffContext } from './permissions';

const contextSchema = z.object({
  user_id: z.string(),
  role: z.enum(['owner', 'staff']),
  display_name: z.string(),
  employee_id: z.string().nullable(),
  is_active: z.boolean(),
  must_change_password: z.boolean(),
  // Chưa chạy 23_security_hardening.sql: không có các trường này → coi như không bắt buộc 2 lớp.
  aal: z.enum(['aal1', 'aal2']).catch('aal1').default('aal1'),
  mfa_required: z.boolean().catch(false).default(false),
  mfa_enrolled: z.boolean().catch(false).default(false),
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

/** Kết quả RPC `my_staff_context` → StaffContext (null nếu sai dạng). */
export function parseStaffContext(raw: unknown): StaffContext | null {
  const parsed = contextSchema.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    userId: c.user_id,
    role: c.role,
    displayName: c.display_name,
    employeeId: c.employee_id,
    isActive: c.is_active,
    mustChangePassword: c.must_change_password,
    aal: c.aal,
    mfaRequired: c.mfa_required,
    mfaEnrolled: c.mfa_enrolled,
    branches: c.branches.map((b) => ({
      branchId: b.branch_id,
      name: b.name,
      slug: b.slug,
      permissions: b.permissions,
    })),
  };
}

/** Ghi nhớ quyền vừa đọc được bằng token này (xem context-cache.ts). */
export function rememberStaffContext(session: { access_token: string; expires_at?: number } | null, ctx: StaffContext): void {
  if (!session?.access_token || !session.expires_at) return;
  writeCachedContext(tokenCacheKey(session.access_token), ctx, session.expires_at * 1000);
}

/**
 * Vai trò + quyền HIỆU LỰC theo chi nhánh, tính bởi database (cùng hàm RLS dùng).
 * null = chưa đăng nhập hoặc không phải tài khoản nhân sự.
 *
 * Nhanh: token đã được database xác minh trong 60 giây gần đây → dùng lại kết quả (không tốn lượt mạng).
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  // Không gọi getClaims trước (tốn thêm 1 lượt mạng): RPC chạy bằng JWT trong cookie, PostgREST tự
  // xác minh chữ ký + hạn; JWT sai/hết hạn → lỗi → null. Proxy đã làm mới phiên trước khi render.
  if (!isSupabaseConfigured() || !(await hasSessionCookie())) return null;
  const supabase = await createClient();
  // getSession chỉ đọc cookie (không gọi mạng khi token còn hạn) — dùng token làm khóa bộ nhớ đệm, KHÔNG dùng để tin.
  const { data: auth } = await supabase.auth.getSession();
  const session = auth.session;
  const key = session?.access_token ? tokenCacheKey(session.access_token) : null;
  const hit = key ? readCachedContext(key) : null;
  if (hit) return hit;
  const { data, error } = await supabase.rpc('my_staff_context');
  if (error || data === null) return null;
  const ctx = parseStaffContext(data);
  if (ctx) rememberStaffContext(session, ctx);
  return ctx;
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
