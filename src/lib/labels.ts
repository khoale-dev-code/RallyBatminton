import { type Enums } from '@/lib/supabase/database.types';

export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'ink';

export const BOOKING_STATUS: Record<Enums<'booking_status'>, { label: string; tone: Tone }> = {
  held: { label: 'Đang giữ chỗ', tone: 'amber' },
  confirmed: { label: 'Đã xác nhận', tone: 'green' },
  checked_in: { label: 'Đã đến sân', tone: 'ink' },
  completed: { label: 'Hoàn tất', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  expired: { label: 'Hết hạn giữ', tone: 'neutral' },
  no_show: { label: 'Không đến', tone: 'red' },
};

export const BOOKING_SOURCE: Record<Enums<'booking_source'>, string> = {
  online: 'Website',
  counter: 'Tại quầy',
  recurring: 'Lịch cố định',
  system: 'Hệ thống',
};

export const PAYMENT_METHOD: Record<Enums<'payment_method'>, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  e_wallet: 'Ví điện tử',
  gateway: 'Chuyển khoản tự động (SePay)',
};

export const MANUAL_PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'e_wallet'] as const satisfies ReadonlyArray<
  Enums<'payment_method'>
>;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export const PAYMENT_STATUS: Record<Enums<'payment_status'>, { label: string; tone: Tone }> = {
  pending: { label: 'Chờ xác nhận', tone: 'amber' },
  succeeded: { label: 'Thành công', tone: 'green' },
  failed: { label: 'Thất bại', tone: 'red' },
  voided: { label: 'Đã hủy', tone: 'neutral' },
};

export const BRANCH_STATUS: Record<Enums<'branch_status'>, { label: string; tone: Tone }> = {
  draft: { label: 'Bản nháp', tone: 'neutral' },
  published: { label: 'Đang mở đặt', tone: 'green' },
  paused: { label: 'Tạm ngưng', tone: 'amber' },
  archived: { label: 'Đã đóng', tone: 'red' },
};

export const COURT_STATUS: Record<Enums<'court_status'>, { label: string; tone: Tone }> = {
  active: { label: 'Hoạt động', tone: 'green' },
  maintenance: { label: 'Bảo trì', tone: 'amber' },
  retired: { label: 'Ngừng sử dụng', tone: 'neutral' },
};

export const ATTENDANCE_STATUS: Record<Enums<'attendance_status'>, { label: string; tone: Tone }> = {
  scheduled: { label: 'Đã xếp', tone: 'neutral' },
  present: { label: 'Có mặt', tone: 'green' },
  absent: { label: 'Vắng', tone: 'red' },
  leave: { label: 'Nghỉ phép', tone: 'amber' },
  cancelled: { label: 'Đã hủy ca', tone: 'neutral' },
};

export const STOCK_REASON: Record<Enums<'stock_reason'>, string> = {
  opening: 'Tồn đầu kỳ',
  purchase: 'Nhập hàng',
  sale: 'Bán',
  sale_void: 'Hủy đơn bán',
  rental_out: 'Xuất cho thuê',
  rental_return: 'Nhận trả',
  adjustment: 'Điều chỉnh',
  damage: 'Hỏng',
  loss: 'Mất',
  count_correction: 'Kiểm kê',
};

export const RENTAL_STATUS: Record<Enums<'rental_status'>, { label: string; tone: Tone }> = {
  out: { label: 'Đang thuê', tone: 'amber' },
  returned: { label: 'Đã trả', tone: 'green' },
  voided: { label: 'Đã hủy', tone: 'neutral' },
};

export const RENTAL_USAGE: Record<Enums<'rental_usage'>, { label: string; short: string; tone: Tone }> = {
  on_site: { label: 'Dùng tại sân', short: 'Tại sân', tone: 'green' },
  take_out: { label: 'Mang ra ngoài', short: 'Mang về', tone: 'amber' },
};

export const RENTAL_BILLING: Record<Enums<'rental_billing'>, string> = {
  duration: 'Theo thời lượng',
  session: 'Theo trận',
};

/** 3 hình thức gói thuê hiển thị cho người dùng (usage + billing). */
export const RENTAL_RATE_KINDS = [
  { value: 'on_site:duration', usage: 'on_site', billing: 'duration', label: 'Tại sân, theo giờ' },
  { value: 'on_site:session', usage: 'on_site', billing: 'session', label: 'Tại sân, hết trận' },
  { value: 'take_out:duration', usage: 'take_out', billing: 'duration', label: 'Mang ra ngoài' },
] as const satisfies ReadonlyArray<{ value: string; usage: Enums<'rental_usage'>; billing: Enums<'rental_billing'>; label: string }>;

export type RentalRateKind = (typeof RENTAL_RATE_KINDS)[number]['value'];

export function rentalRateKind(usage: Enums<'rental_usage'>, billing: Enums<'rental_billing'>): (typeof RENTAL_RATE_KINDS)[number] {
  return RENTAL_RATE_KINDS.find((k) => k.usage === usage && k.billing === billing) ?? RENTAL_RATE_KINDS[0];
}

export const EMPLOYMENT_TYPE: Record<Enums<'employment_type'>, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
};

export const PAY_TYPE: Record<Enums<'pay_type'>, string> = {
  hourly: 'Theo giờ',
  daily: 'Theo ngày công',
};
