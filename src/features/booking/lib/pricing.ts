import { addDays, isoWeekday, minutesToTime, timeToMinutes } from '@/lib/time';

export interface PriceRuleLite {
  id: string;
  court_id: string | null;
  days_mask: number;
  starts_at: string;
  ends_at: string;
  price_per_hour: number;
  priority: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

/**
 * Quy tắc giá áp dụng cho một ô — cùng thứ tự với private.quote_court_price trong database:
 * giá riêng sân > giá mặc định; priority cao hơn; tạo trước; id.
 * Database luôn là nơi tính giá cuối cùng; hàm này để hiển thị tức thì trên lưới giờ.
 */
export function ruleForSlot(
  rules: PriceRuleLite[],
  courtId: string,
  dateKey: string,
  startTime: string,
  slotMinutes: number,
): PriceRuleLite | null {
  const dayBit = 1 << (isoWeekday(dateKey) - 1);
  const start = timeToMinutes(startTime);
  const end = start + slotMinutes;
  const candidates = rules.filter(
    (r) =>
      (r.court_id === courtId || r.court_id === null) &&
      (r.days_mask & dayBit) !== 0 &&
      timeToMinutes(r.starts_at) <= start &&
      timeToMinutes(r.ends_at) >= end &&
      (r.valid_from === null || r.valid_from <= dateKey) &&
      (r.valid_until === null || r.valid_until >= dateKey),
  );
  candidates.sort((a, b) => {
    const courtRank = Number(b.court_id !== null) - Number(a.court_id !== null);
    if (courtRank !== 0) return courtRank;
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  return candidates[0] ?? null;
}

export interface QuoteResult {
  total: number;
  deposit: number;
  complete: boolean;
}

export function roundTotal(raw: number): number {
  return Math.round(raw / 1000) * 1000;
}

export function depositFor(total: number, depositPercent: number): number {
  return Math.min(total, Math.ceil((total * depositPercent) / 100 / 1000) * 1000);
}

export function quoteSlots(
  rules: PriceRuleLite[],
  courtId: string,
  dateKey: string,
  startTimes: string[],
  slotMinutes: number,
  depositPercent: number,
): QuoteResult {
  let raw = 0;
  let complete = true;
  for (const t of startTimes) {
    const rule = ruleForSlot(rules, courtId, dateKey, t, slotMinutes);
    if (!rule) complete = false;
    else raw += (rule.price_per_hour * slotMinutes) / 60;
  }
  const total = roundTotal(raw);
  return { total, deposit: depositFor(total, depositPercent), complete };
}

/** Bảng giá tóm tắt cho trang chi nhánh: nhóm quy tắc theo phạm vi. */
export function describeRuleWindow(rule: Pick<PriceRuleLite, 'starts_at' | 'ends_at'>): string {
  return `${minutesToTime(timeToMinutes(rule.starts_at))}–${minutesToTime(timeToMinutes(rule.ends_at))}`;
}

/** Các ngày tới (tính từ hôm nay) để chọn trên dải ngày. */
export function upcomingDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}
