/**
 * Phụ phí trả trễ đồ thuê — CÙNG công thức với private.rental_overtime (09_rental_pricing.sql).
 * Database là nơi quyết định số tiền khi nhận trả; hàm này chỉ để hiển thị tạm tính trên giao diện.
 *
 *   trễ  = số phút nguyên từ hạn trả đến lúc trả
 *   trễ ≤ ân hạn → 0
 *   block = ceil(trễ / độ dài block) — đếm từ hạn trả, không trừ ân hạn
 *   phí   = block × giá block × số món (có trần thì ≤ trần × số món)
 */

export type RentalUsage = 'on_site' | 'take_out';
export type RentalBilling = 'duration' | 'session';

export interface OvertimePolicy {
  graceMinutes: number;
  blockMinutes: number;
  /** Giá 1 block cho 1 món. */
  blockPrice: number;
  /** Trần phụ phí cho 1 món; null = không giới hạn. */
  cap: number | null;
}

export interface OvertimeResult {
  lateMinutes: number;
  blocks: number;
  fee: number;
  /** Đang trong ân hạn (trễ > 0 nhưng chưa tính phí). */
  inGrace: boolean;
  /** Đã chạm trần phụ phí. */
  capped: boolean;
}

export function computeOvertime(dueAt: Date | number, at: Date | number, quantity: number, policy: OvertimePolicy): OvertimeResult {
  const due = typeof dueAt === 'number' ? dueAt : dueAt.getTime();
  const now = typeof at === 'number' ? at : at.getTime();
  const lateMinutes = Math.max(0, Math.floor((now - due) / 60000));
  if (lateMinutes <= policy.graceMinutes) {
    return { lateMinutes, blocks: 0, fee: 0, inGrace: lateMinutes > 0, capped: false };
  }
  const blocks = Math.ceil(lateMinutes / Math.max(policy.blockMinutes, 1));
  const raw = blocks * policy.blockPrice * quantity;
  const limit = policy.cap === null ? null : policy.cap * quantity;
  const fee = limit === null ? raw : Math.min(raw, limit);
  return { lateMinutes, blocks, fee, inGrace: false, capped: limit !== null && raw > limit };
}

/** Giá block tự tính: tỉ lệ theo giá gói, làm tròn lên 1.000đ (giống private.rental_auto_block_price). */
export function autoBlockPrice(price: number, durationMinutes: number, blockMinutes: number): number {
  if (price <= 0) return 0;
  return Math.ceil((price * blockMinutes) / Math.max(durationMinutes, 1) / 1000) * 1000;
}

/** Mặc định ân hạn & block theo hình thức (giống private.rental_default_policy). */
export function defaultPolicy(
  usage: RentalUsage,
  billing: RentalBilling,
  durationMinutes: number,
): { graceMinutes: number; blockMinutes: number } {
  const graceMinutes = billing === 'session' ? 15 : usage === 'take_out' ? (durationMinutes >= 1440 ? 60 : 30) : 10;
  const blockMinutes = durationMinutes >= 1440 ? 720 : durationMinutes > 240 ? 60 : 30;
  return { graceMinutes, blockMinutes };
}

/** Hạn trả thực tế: thuê theo trận đi theo giờ kết thúc sân nếu khách gia hạn sân. */
export function effectiveDue(dueAt: string, billing: RentalBilling, bookingEnd: Date | null): Date {
  const due = new Date(dueAt);
  if (billing === 'session' && bookingEnd && bookingEnd.getTime() > due.getTime()) return bookingEnd;
  return due;
}

/** "45 phút", "1 giờ 5 phút", "2 ngày 3 giờ" — gọn cho bảng. */
export function formatSpan(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} phút`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h === 0 ? `${d} ngày` : `${d} ngày ${h} giờ`;
}

/** Block hiển thị: 30 → "30 phút", 60 → "giờ", 720 → "12 giờ", 1440 → "ngày". */
export function formatBlock(minutes: number): string {
  if (minutes === 60) return 'giờ';
  if (minutes === 1440) return 'ngày';
  return formatSpan(minutes);
}

/** "Ân hạn 10 phút · 15.000đ / 30 phút / món · tối đa 100.000đ/món" (formatter tiền truyền vào). */
export function describePolicy(policy: OvertimePolicy, money: (n: number) => string): string {
  const parts = [
    policy.graceMinutes > 0 ? `Ân hạn ${formatSpan(policy.graceMinutes)}` : 'Không ân hạn',
    `${money(policy.blockPrice)} / ${formatBlock(policy.blockMinutes)} / món`,
  ];
  if (policy.cap !== null) parts.push(`tối đa ${money(policy.cap)}/món`);
  return parts.join(' · ');
}

/** Tiến độ thời gian thuê 0..1 (vượt hạn = 1) cho thanh tiến độ. */
export function rentalProgress(startsAt: string, due: Date, now: number): number {
  const start = new Date(startsAt).getTime();
  const total = due.getTime() - start;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - start) / total));
}
