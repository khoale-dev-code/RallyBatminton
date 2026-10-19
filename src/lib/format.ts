import { DEFAULT_TZ } from './time';

const vnd = new Intl.NumberFormat('vi-VN');

/** 120000 → "120.000 ₫" */
export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${vnd.format(Math.round(amount))} ₫`;
}

/** 120000 → "120k" (gọn cho lưới giờ) */
export function formatVndShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  return `${Math.round(amount / 1000)}k`;
}

export function formatNumber(value: number): string {
  return vnd.format(value);
}

function dtf(options: Intl.DateTimeFormatOptions, tz: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: tz, ...options });
}

export function formatTime(value: string | Date, tz: string = DEFAULT_TZ): string {
  return dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, tz).format(new Date(value));
}

export function formatDate(value: string | Date, tz: string = DEFAULT_TZ): string {
  return dtf({ day: '2-digit', month: '2-digit', year: 'numeric' }, tz).format(new Date(value));
}

export function formatDateTime(value: string | Date, tz: string = DEFAULT_TZ): string {
  return `${formatTime(value, tz)}, ${formatDate(value, tz)}`;
}

const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** 'YYYY-MM-DD' → { weekday: 'T7', day: '19/10' } (không phụ thuộc múi giờ máy chủ) */
export function describeDateKey(dateKey: string): { weekdayShort: string; weekdayLong: string; dayMonth: string } {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    weekdayShort: WEEKDAYS_SHORT[dow] ?? '',
    weekdayLong: WEEKDAYS_LONG[dow] ?? '',
    dayMonth: `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}`,
  };
}

export function formatDateKey(dateKey: string): string {
  const info = describeDateKey(dateKey);
  return `${info.weekdayLong}, ${info.dayMonth}/${dateKey.slice(0, 4)}`;
}

export function formatMonthKey(monthStart: string): string {
  return `Tháng ${Number(monthStart.slice(5, 7))}/${monthStart.slice(0, 4)}`;
}

/** 0912345678 → "0912 345 678" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const local = phone.startsWith('+84') ? `0${phone.slice(3)}` : phone;
  return /^0\d{9}$/.test(local) ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : phone;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/** Bitmask ngày (bit0 = T2 … bit6 = CN) → "T2–T6", "T7, CN", "Cả tuần" */
export function formatDaysMask(mask: number): string {
  if (mask === 127) return 'Cả tuần';
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const days = labels.map((_, i) => (mask & (1 << i)) !== 0);
  const runs: string[] = [];
  let i = 0;
  while (i < 7) {
    if (!days[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < 7 && days[j + 1]) j += 1;
    runs.push(j - i >= 2 ? `${labels[i]}–${labels[j]}` : labels.slice(i, j + 1).join(', '));
    i = j + 1;
  }
  return runs.join(', ');
}

/** "1 giờ" + 60 phút → "1 giờ" (không lặp); "Buổi sáng" + 180 → "Buổi sáng (3 giờ)" */
export function formatRateLabel(label: string, minutes: number): string {
  const duration = formatMinutes(minutes);
  return label.trim().toLowerCase() === duration.toLowerCase() ? label : `${label} (${duration})`;
}

/**
 * Nhãn biến thể từ 2 thuộc tính (size_label = thuộc tính 1, color_label = thuộc tính 2).
 * Không có tên thuộc tính: "M / Đỏ". Có tên: "Kích thước M, Màu sắc Đỏ".
 */
export function formatVariantLabel(
  value1: string | null | undefined,
  value2: string | null | undefined,
  names?: { option1?: string | null; option2?: string | null },
): string | null {
  const parts = [
    value1 ? (names?.option1 ? `${names.option1} ${value1}` : value1) : null,
    value2 ? (names?.option2 ? `${names.option2} ${value2}` : value2) : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return parts.join(names ? ', ' : ' / ');
}
