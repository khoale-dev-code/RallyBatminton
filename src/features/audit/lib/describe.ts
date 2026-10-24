import { formatVnd } from '@/lib/format';
import {
  ATTENDANCE_STATUS,
  BOOKING_STATUS,
  BRANCH_STATUS,
  CASH_DRAWER_TRIGGER,
  COURT_STATUS,
  PAYMENT_STATUS,
  RENTAL_STATUS,
  isCashDrawerTrigger,
} from '@/lib/labels';

/**
 * Diễn giải một dòng nhật ký cho chủ sân đọc: lý do kỹ thuật ("system: auto complete") → câu tiếng Việt,
 * tên cột → nhãn, đổi trạng thái → "Đã đến sân → Hoàn tất", tên bản ghi (mã đơn, tên khách…) và link mở bản ghi.
 */

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Cột tự sinh / kỹ thuật — không hiện trong danh sách trường đổi. */
const NOISE = new Set(['updated_at', 'status_changed_at', 'search_text', 'version']);

const FIELD_LABEL: Record<string, string> = {
  status: 'Trạng thái',
  during: 'Giờ chơi',
  court_id: 'Sân',
  completed_at: 'Giờ hoàn tất',
  checked_in_at: 'Giờ nhận sân',
  checked_out_at: 'Giờ ra',
  cancelled_at: 'Giờ hủy',
  cancel_reason: 'Lý do hủy',
  subtotal_amount: 'Tiền sân',
  total_amount: 'Tổng tiền',
  discount_amount: 'Giảm giá',
  deposit_amount: 'Tiền cọc',
  price_snapshot: 'Bảng giá áp dụng',
  hold_expires_at: 'Hạn giữ chỗ',
  internal_note: 'Ghi chú nội bộ',
  customer_note: 'Ghi chú của khách',
  contact_name: 'Tên người đặt',
  full_name: 'Họ tên',
  phone: 'Số điện thoại',
  name: 'Tên',
  slug: 'Đường dẫn',
  price: 'Giá',
  price_per_hour: 'Giá mỗi giờ',
  is_active: 'Đang dùng',
  on_hand: 'Tồn kho',
  reorder_level: 'Mức cảnh báo tồn',
  is_listed: 'Bày bán',
  amount: 'Số tiền',
  reason: 'Lý do',
  reference: 'Mã giao dịch',
  method: 'Hình thức',
  hourly_rate: 'Lương giờ',
  daily_rate: 'Lương ngày',
  scheduled_start: 'Giờ vào ca',
  scheduled_end: 'Giờ ra ca',
  paid_minutes: 'Phút công',
  staff_note: 'Ghi chú nhân viên',
  deleted_at: 'Đã xóa',
  description: 'Mô tả',
  sort_order: 'Thứ tự',
  photo_path: 'Ảnh',
  cover_path: 'Ảnh bìa',
  note: 'Ghi chú',
  must_change_password: 'Bắt đổi mật khẩu',
  display_name: 'Tên hiển thị',
  login_phone: 'SĐT đăng nhập',
  role: 'Vai trò',
  permission: 'Quyền',
  received_at: 'Giờ nhận tiền',
  void_reason: 'Lý do hủy',
  voided_at: 'Giờ hủy',
  attendance_status: 'Chấm công',
  break_minutes: 'Phút nghỉ',
  employee_id: 'Nhân viên',
  work_date: 'Ngày làm',
  opens_at: 'Giờ mở cửa',
  closes_at: 'Giờ đóng cửa',
  effective_from: 'Áp dụng từ',
  pay_type: 'Kiểu lương',
  trigger: 'Lý do mở',
  ref_code: 'Mã đơn',
  device_label: 'Máy',
};

export function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key.replace(/_/g, ' ');
}

/** Các trường đổi giữa bản cũ và mới (bỏ cột kỹ thuật), đã gắn nhãn. */
export function changedFieldLabels(oldData: unknown, newData: unknown): string[] {
  if (!isRecord(oldData) || !isRecord(newData)) return [];
  return Object.keys(newData)
    .filter((k) => !NOISE.has(k) && JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]))
    .map(fieldLabel);
}

const STATUS_LABELS: Record<string, Record<string, { label: string }>> = {
  bookings: BOOKING_STATUS,
  payments: PAYMENT_STATUS,
  branches: BRANCH_STATUS,
  rentals: RENTAL_STATUS,
  shifts: ATTENDANCE_STATUS,
  courts: COURT_STATUS,
  sales: { completed: { label: 'Hoàn tất' }, voided: { label: 'Đã hủy' } },
};

/** "Đã đến sân → Hoàn tất" khi trạng thái đổi; null nếu không đổi. */
export function statusChange(table: string, oldData: unknown, newData: unknown): { from: string; to: string } | null {
  if (!isRecord(oldData) || !isRecord(newData)) return null;
  const a = str(oldData.status);
  const b = str(newData.status);
  if (!a || !b || a === b) return null;
  const map = STATUS_LABELS[table];
  return { from: map?.[a]?.label ?? a, to: map?.[b]?.label ?? b };
}

const REASONS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^system: auto complete$/i, () => 'Tự động hoàn tất khi hết giờ chơi'],
  [/^system: hold expired$/i, () => 'Tự hủy giữ chỗ quá hạn chưa đặt cọc'],
  [/^(?:system: )?sepay:? (\S+)$/i, (m) => `SePay báo tiền về (giao dịch ${m[1]})`],
  [/^system: reconcile.*$/i, () => 'Đối soát SePay ghi bù giao dịch'],
  [/^guest cancel$/i, () => 'Khách tự hủy trên website'],
  [/^member cancel$/i, () => 'Thành viên tự hủy trên website'],
  [/^extend: \+(\d+) phút(?: · (.+))?$/i, (m) => `Gia hạn thêm ${m[1]} phút${m[2] ? ` · ${m[2]}` : ''}`],
  [/^overtime_offer$/i, () => 'Đề nghị tăng ca'],
  [/^pos: (.+)$/i, (m) => `Bán hàng: ${m[1]}`],
];

export function describeReason(reason: string | null): string | null {
  const r = reason?.trim();
  if (!r) return null;
  for (const [re, fmt] of REASONS) {
    const m = r.match(re);
    if (m) return fmt(m);
  }
  return r;
}

const DETAIL_PATH: Record<string, string> = {
  bookings: '/admin/bookings/',
  customers: '/admin/customers/',
  products: '/admin/catalog/',
  employees: '/admin/staff/',
  branches: '/admin/branches/',
  sales: '/admin/sales/',
  rentals: '/admin/rentals/',
  shifts: '/admin/shifts/',
  courts: '/admin/courts/',
};

/** Tên dễ nhận ra của bản ghi (mã đơn, tên khách, tên sản phẩm…) và link mở bản ghi (nếu còn trang chi tiết). */
export function recordTitle(
  table: string,
  recordId: string | null,
  oldData: unknown,
  newData: unknown,
  action: string,
): { title: string | null; href: string | null } {
  const data = isRecord(newData) ? newData : isRecord(oldData) ? oldData : {};
  if (table === 'cash_drawer_events') {
    const label = isCashDrawerTrigger(data.trigger) ? CASH_DRAWER_TRIGGER[data.trigger] : 'Mở ngăn kéo';
    const ref = str(data.ref_code);
    return { title: ref ? `${label} · ${ref}` : label, href: null };
  }
  const amount =
    typeof data.amount === 'number' && (table === 'payments' || table === 'payroll_adjustments') ? formatVnd(data.amount) : null;
  const title =
    str(data.code) ?? str(data.full_name) ?? str(data.name) ?? str(data.contact_name) ?? str(data.label) ?? str(data.sku) ?? amount;
  const base = DETAIL_PATH[table];
  const href = base && recordId && action !== 'DELETE' ? `${base}${recordId}` : null;
  return { title, href };
}
