/**
 * Báo cáo cho chủ sân — phần thuần (không phụ thuộc React / database): đọc bộ lọc trên URL, khoảng thời gian có sẵn,
 * gộp chuỗi ngày thành tuần / tháng, tỷ lệ lấp sân, mức màu bản đồ nhiệt.
 */
import { BOOKING_SOURCE, PAYMENT_METHOD } from '@/lib/labels';
import { addDays, addMonths, isDateKey, isoWeekday, monthKey, startOfIsoWeek } from '@/lib/time';

export const REPORT_TABS = [
  { key: 'doanh-thu', label: 'Doanh thu' },
  { key: 'lap-san', label: 'Lấp sân' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'hang-hoa', label: 'Hàng hóa' },
  { key: 'ket-tien', label: 'Két tiền' },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]['key'];

export const REPORT_PRESETS = [
  { key: '7', label: '7 ngày' },
  { key: '30', label: '30 ngày' },
  { key: 'thang-nay', label: 'Tháng này' },
  { key: 'thang-truoc', label: 'Tháng trước' },
  { key: '90', label: '90 ngày' },
  { key: 'nam-nay', label: 'Năm nay' },
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number]['key'];

/** Database nhận tối đa 366 ngày. */
export const MAX_REPORT_DAYS = 366;

export interface ReportQuery {
  tab: ReportTab;
  from: string;
  to: string;
  branch: string | null;
  preset: ReportPreset | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTab(v: string | undefined): v is ReportTab {
  return REPORT_TABS.some((t) => t.key === v);
}
function isPreset(v: string | undefined): v is ReportPreset {
  return REPORT_PRESETS.some((p) => p.key === v);
}

export function presetRange(preset: ReportPreset, today: string): { from: string; to: string } {
  switch (preset) {
    case '7':
      return { from: addDays(today, -6), to: today };
    case '30':
      return { from: addDays(today, -29), to: today };
    case '90':
      return { from: addDays(today, -89), to: today };
    case 'thang-nay':
      return { from: monthKey(today), to: today };
    case 'thang-truoc': {
      const start = addMonths(monthKey(today), -1);
      return { from: start, to: addDays(monthKey(today), -1) };
    }
    case 'nam-nay':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Số ngày trong khoảng (tính cả hai đầu). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Đọc bộ lọc từ URL; giá trị lạ → mặc định (30 ngày, mọi chi nhánh, mục Doanh thu). */
export function parseReportQuery(sp: Record<string, string | string[] | undefined>, today: string): ReportQuery {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const muc = one('muc');
  const tab: ReportTab = isTab(muc) ? muc : 'doanh-thu';
  const branchRaw = one('branch');
  const branch = branchRaw && UUID.test(branchRaw) ? branchRaw.toLowerCase() : null;
  const presetRaw = one('ky');
  let from = one('from') ?? '';
  let to = one('to') ?? '';
  let preset: ReportPreset | null = null;
  if (!isDateKey(from) || !isDateKey(to)) {
    preset = isPreset(presetRaw) ? presetRaw : '30';
    ({ from, to } = presetRange(preset, today));
  } else {
    if (from > to) [from, to] = [to, from];
    if (daysBetween(from, to) > MAX_REPORT_DAYS) from = addDays(to, -(MAX_REPORT_DAYS - 1));
  }
  return { tab, from, to, branch, preset };
}

/** Chuỗi truy vấn của trang báo cáo (giữ bộ lọc khi đổi mục / xuất file). */
export function reportHref(base: string, q: ReportQuery, change: Partial<ReportQuery> = {}): string {
  const next = { ...q, ...change };
  const params = new URLSearchParams();
  params.set('muc', next.tab);
  if (next.preset) params.set('ky', next.preset);
  else {
    params.set('from', next.from);
    params.set('to', next.to);
  }
  if (next.branch) params.set('branch', next.branch);
  return `${base}?${params.toString()}`;
}

/** "01/10 – 24/10/2026" */
export function rangeLabel(from: string, to: string): string {
  const d = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
  return from === to ? `${d(from)}/${from.slice(0, 4)}` : `${d(from)} – ${d(to)}/${to.slice(0, 4)}`;
}

// ---- Chuỗi doanh thu theo ngày → cột theo ngày / tuần / tháng --------------------------------------------

export interface RevenueDay {
  day: string;
  booking: number;
  sale: number;
  rental: number;
  refund: number;
}

export type Grain = 'day' | 'week' | 'month';

export interface RevenueBar {
  key: string;
  label: string;
  /** Mô tả đầy đủ khoảng của cột (chú thích khi rê chuột). */
  title: string;
  booking: number;
  sale: number;
  rental: number;
  refund: number;
}

export function grainFor(days: number): Grain {
  if (days <= 62) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export function bucketRevenue(series: RevenueDay[], grain: Grain): RevenueBar[] {
  const keyOf = (day: string) => (grain === 'day' ? day : grain === 'week' ? startOfIsoWeek(day) : monthKey(day));
  const map = new Map<string, RevenueBar>();
  for (const d of series) {
    const key = keyOf(d.day.slice(0, 10));
    const bar = map.get(key) ?? {
      key,
      label: grain === 'month' ? `${key.slice(5, 7)}/${key.slice(2, 4)}` : dm(key),
      title:
        grain === 'day'
          ? `${dm(key)}/${key.slice(0, 4)}`
          : grain === 'week'
            ? `Tuần từ ${dm(key)}`
            : `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`,
      booking: 0,
      sale: 0,
      rental: 0,
      refund: 0,
    };
    bar.booking += d.booking;
    bar.sale += d.sale;
    bar.rental += d.rental;
    bar.refund += d.refund;
    map.set(key, bar);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;
export const WEEKDAY_LONG = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'] as const;

/** Thực thu trung bình mỗi ngày theo thứ trong tuần (T2 … CN). */
export function weekdayAverages(series: RevenueDay[]): Array<{ dow: number; label: string; average: number }> {
  const sum = Array.from({ length: 7 }, () => 0);
  const count = Array.from({ length: 7 }, () => 0);
  for (const d of series) {
    const i = isoWeekday(d.day.slice(0, 10)) - 1;
    sum[i] = (sum[i] ?? 0) + d.booking + d.sale + d.rental - d.refund;
    count[i] = (count[i] ?? 0) + 1;
  }
  return sum.map((s, i) => ({
    dow: i + 1,
    label: WEEKDAY_LONG[i] ?? '',
    average: (count[i] ?? 0) > 0 ? Math.round(s / (count[i] ?? 1)) : 0,
  }));
}

// ---- Lấp sân --------------------------------------------------------------------------------------------

/** % lấp sân (null khi không có giờ mở cửa). */
export function occupancyPct(booked: number, capacity: number): number | null {
  if (capacity <= 0) return null;
  return Math.min(100, Math.round((booked / capacity) * 100));
}

/** Mức màu bản đồ nhiệt (0 = trống … 5 = kín). */
export function heatLevel(pct: number | null): number {
  if (pct === null || pct <= 0) return 0;
  if (pct < 20) return 1;
  if (pct < 40) return 2;
  if (pct < 60) return 3;
  if (pct < 80) return 4;
  return 5;
}

export interface HeatCell {
  dow: number;
  h: number;
  booked: number;
  capacity: number;
}

/** Lưới thứ × giờ (chỉ các giờ có mở cửa) + các khung giờ vắng nhất để gợi ý khuyến mãi. */
export function heatGrid(cells: HeatCell[]): {
  hours: number[];
  get: (dow: number, h: number) => HeatCell | undefined;
  quietest: Array<HeatCell & { pct: number }>;
} {
  const hours = [...new Set(cells.map((c) => c.h))].sort((a, b) => a - b);
  const map = new Map(cells.map((c) => [`${c.dow}:${c.h}`, c]));
  const quietest = cells
    .map((c) => ({ ...c, pct: occupancyPct(c.booked, c.capacity) ?? 0 }))
    .filter((c) => c.capacity > 0)
    .sort((a, b) => a.pct - b.pct || a.dow - b.dow || a.h - b.h)
    .slice(0, 5);
  return { hours, get: (dow, h) => map.get(`${dow}:${h}`), quietest };
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return `${h.toLocaleString('vi-VN', { maximumFractionDigits: h < 10 ? 1 : 0 })} giờ`;
}

/** Tỷ lệ % (null khi mẫu số 0). */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function isMethod(m: string): m is keyof typeof PAYMENT_METHOD {
  return m in PAYMENT_METHOD;
}
function isSource(s: string): s is keyof typeof BOOKING_SOURCE {
  return s in BOOKING_SOURCE;
}
export const paymentMethodLabel = (m: string): string => (isMethod(m) ? PAYMENT_METHOD[m] : m);
export const bookingSourceLabel = (s: string): string => (isSource(s) ? BOOKING_SOURCE[s] : s);
