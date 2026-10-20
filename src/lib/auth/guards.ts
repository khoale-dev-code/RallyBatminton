import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACTIVE_BRANCH_COOKIE, getActiveBranch, getStaffContext } from './context';
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

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value): Settled<T> => ({ ok: true, value }),
    (error: unknown): Settled<T> => ({ ok: false, error }),
  );
}

async function unwrap<T>(settled: Promise<Settled<T>>): Promise<T> {
  const s = await settled;
  if (!s.ok) throw s.error;
  return s.value;
}

/**
 * Như requireBranchPermission, nhưng chạy truy vấn của trang SONG SONG với việc tải quyền (tiết kiệm 1 lượt
 * mạng tới Supabase mỗi lần mở trang): đoán chi nhánh từ cookie rồi xác minh sau. Đoán sai (lần đầu, đổi
 * chi nhánh) → bỏ kết quả và tải lại đúng chi nhánh. An toàn: truy vấn chạy bằng JWT của chính người dùng,
 * RLS chặn dữ liệu ngoài quyền; kết quả chỉ được dùng khi chi nhánh đã được xác minh.
 */
export async function requireBranchData<T>(
  permission: AppPermission,
  load: (branchId: string) => Promise<T>,
): Promise<{ ctx: StaffContext; branch: StaffBranch; data: T }> {
  const store = await cookies();
  const guess = store.get(ACTIVE_BRANCH_COOKIE)?.value ?? null;
  const speculative = guess ? settle(load(guess)) : null;
  const { ctx, branch } = await requireBranchPermission(permission);
  const data = speculative && branch.branchId === guess ? await unwrap(speculative) : await load(branch.branchId);
  return { ctx, branch, data };
}

/**
 * Chạy truy vấn không phụ thuộc chi nhánh (theo id, RLS bảo vệ) song song với bước kiểm tra quyền.
 * Kiểm tra quyền thất bại → chuyển hướng như cũ, kết quả truy vấn bị bỏ.
 * Ví dụ: `const [ctx, data] = await withGuard(requireStaff(), () => getBookingDetail(id));`
 */
export async function withGuard<G, T>(guard: Promise<G>, load: () => Promise<T>): Promise<[G, T]> {
  const data = settle(load());
  const checked = await guard;
  return [checked, await unwrap(data)];
}
