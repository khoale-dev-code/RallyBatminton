import { Constants, type Enums } from '@/lib/supabase/database.types';

export type AppPermission = Enums<'app_permission'>;
export type AppRole = Enums<'app_role'>;

export const ALL_PERMISSIONS = Constants.public.Enums.app_permission;

export interface StaffBranch {
  branchId: string;
  name: string;
  slug: string;
  permissions: AppPermission[];
}

export interface StaffContext {
  userId: string;
  role: AppRole;
  displayName: string;
  employeeId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Mức xác thực của phiên: aal2 = đã nhập mã xác thực 2 lớp. */
  aal: 'aal1' | 'aal2';
  /** Chủ sân bật "bắt buộc 2 lớp" cho vai trò này (23_security_hardening.sql). */
  mfaRequired: boolean;
  /** Đã cài ứng dụng xác thực (có mã 2 lớp đã xác minh). */
  mfaEnrolled: boolean;
  branches: StaffBranch[];
}

/** Phiên chưa đủ xác thực: database chưa cấp quyền nào cho tới khi nhập mã 2 lớp. */
export function needsMfa(ctx: StaffContext): boolean {
  return ctx.mfaRequired && ctx.aal !== 'aal2';
}

export const PERMISSION_GROUPS: Array<{
  title: string;
  items: Array<{ key: AppPermission; label: string; hint: string }>;
}> = [
  {
    title: 'Đặt sân',
    items: [
      { key: 'booking.view', label: 'Xem lịch đặt sân', hint: 'Xem booking và thông tin khách của chi nhánh' },
      { key: 'booking.confirm', label: 'Xác nhận giữ chỗ', hint: 'Chuyển giữ chỗ thành đã xác nhận' },
      { key: 'booking.operate', label: 'Điều hành tại quầy', hint: 'Tạo đơn, đổi giờ, hủy, check-in, khóa sân' },
      { key: 'payment.record', label: 'Ghi nhận tiền thu', hint: 'Ghi tiền mặt/chuyển khoản cho booking' },
    ],
  },
  {
    title: 'Hàng hóa',
    items: [
      { key: 'catalog.view', label: 'Xem sản phẩm & tồn kho', hint: 'Xem sản phẩm, tồn kho chi nhánh' },
      { key: 'catalog.edit', label: 'Quản lý sản phẩm', hint: 'Thêm/sửa sản phẩm, ảnh, giá (toàn thương hiệu)' },
      { key: 'inventory.adjust', label: 'Điều chỉnh tồn kho', hint: 'Nhập hàng, kiểm kê, ghi hỏng/mất' },
      { key: 'sale.record', label: 'Bán hàng tại quầy', hint: 'Lập đơn bán, thu tiền' },
      { key: 'rental.operate', label: 'Cho thuê thiết bị', hint: 'Xuất thuê, nhận trả, thu phí' },
    ],
  },
  {
    title: 'Nhân sự',
    items: [{ key: 'shift.view_branch', label: 'Xem lịch ca chi nhánh', hint: 'Xem ca của đồng nghiệp (không gồm lương)' }],
  },
];

export const PERMISSION_LABEL: Record<AppPermission, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
) as Record<AppPermission, string>;

export function isOwner(ctx: StaffContext): boolean {
  return ctx.role === 'owner';
}

/** Có quyền ở chi nhánh cụ thể, hoặc ở bất kỳ chi nhánh nào nếu không truyền branchId. */
export function hasPermission(ctx: StaffContext, permission: AppPermission, branchId?: string | null): boolean {
  return ctx.branches.some((b) => (branchId ? b.branchId === branchId : true) && b.permissions.includes(permission));
}

export function branchesWith(ctx: StaffContext, permission?: AppPermission): StaffBranch[] {
  return permission ? ctx.branches.filter((b) => b.permissions.includes(permission)) : ctx.branches;
}
