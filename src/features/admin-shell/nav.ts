import { hasPermission, isOwner, type StaffContext } from '@/lib/auth/permissions';

export type NavIcon =
  | 'dashboard'
  | 'calendar'
  | 'users'
  | 'cart'
  | 'package'
  | 'boxes'
  | 'tag'
  | 'clock'
  | 'qr'
  | 'building'
  | 'id'
  | 'wallet'
  | 'log'
  | 'settings'
  | 'me'
  | 'receipt'
  | 'scan';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export type NavGroupKey = 'ops' | 'goods' | 'hr' | 'admin';

export interface NavGroup {
  key: NavGroupKey;
  title: string;
  items: NavItem[];
}

/** Cookie ghi nhớ giao diện menu (chỉ là tùy chọn hiển thị, không liên quan phân quyền). */
export const SIDEBAR_COOKIE = 'rally_sidebar';
export const NAV_CLOSED_COOKIE = 'rally_nav_closed';
export const NAV_GROUP_KEYS: NavGroupKey[] = ['ops', 'goods', 'hr', 'admin'];

/** Menu chỉ hiện mục người dùng có quyền — chỉ là tiện ích; database vẫn chặn bằng RLS. */
export function buildNav(ctx: StaffContext): NavGroup[] {
  const owner = isOwner(ctx);
  const can = (p: Parameters<typeof hasPermission>[1]) => owner || hasPermission(ctx, p);
  const groups: NavGroup[] = [
    {
      key: 'ops',
      title: 'Vận hành',
      items: [
        { href: '/admin', label: 'Tổng quan', icon: 'dashboard' as const },
        ...(can('booking.view') ? [{ href: '/admin/bookings', label: 'Lịch đặt sân', icon: 'calendar' as const }] : []),
        ...(can('booking.view') ? [{ href: '/admin/customers', label: 'Khách hàng', icon: 'users' as const }] : []),
        ...(can('sale.record') ? [{ href: '/admin/pos', label: 'Bán hàng', icon: 'cart' as const }] : []),
        ...(can('sale.record') ? [{ href: '/admin/sales', label: 'Đơn bán', icon: 'receipt' as const }] : []),
        ...(can('rental.operate') ? [{ href: '/admin/rentals', label: 'Cho thuê', icon: 'package' as const }] : []),
      ],
    },
    {
      key: 'goods',
      title: 'Hàng hóa',
      items: [
        ...(can('catalog.view') ? [{ href: '/admin/inventory', label: 'Tồn kho', icon: 'boxes' as const }] : []),
        ...(can('catalog.view') ? [{ href: '/admin/catalog', label: 'Quản lý sản phẩm', icon: 'tag' as const }] : []),
      ],
    },
    {
      key: 'hr',
      title: 'Nhân sự',
      items: [
        ...(can('shift.view_branch') ? [{ href: '/admin/shifts', label: 'Lịch ca', icon: 'clock' as const }] : []),
        ...(owner ? [{ href: '/admin/attendance', label: 'Mã QR chấm công', icon: 'qr' as const }] : []),
        ...(owner ? [{ href: '/admin/staff', label: 'Nhân viên', icon: 'id' as const }] : []),
        ...(owner ? [{ href: '/admin/payroll', label: 'Bảng lương', icon: 'wallet' as const }] : []),
        ...(ctx.employeeId ? [{ href: '/admin/me', label: 'Ca & lương của tôi', icon: 'me' as const }] : []),
        ...(ctx.employeeId ? [{ href: '/checkin', label: 'Quét QR chấm công', icon: 'scan' as const }] : []),
      ],
    },
    {
      key: 'admin',
      title: 'Quản trị',
      items: owner
        ? [
            { href: '/admin/branches', label: 'Chi nhánh & sân', icon: 'building' as const },
            { href: '/admin/audit', label: 'Nhật ký thay đổi', icon: 'log' as const },
            { href: '/admin/settings', label: 'Cài đặt thương hiệu', icon: 'settings' as const },
          ]
        : [],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}
