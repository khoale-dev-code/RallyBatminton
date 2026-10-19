/**
 * Tiện ích thời gian theo múi giờ chi nhánh (mặc định Asia/Ho_Chi_Minh), chỉ dùng Intl — không thêm thư viện.
 * Quy ước: "date key" = 'YYYY-MM-DD' theo giờ địa phương; "time" = 'HH:mm' hoặc 'HH:mm:ss'.
 */
export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = partFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partFormatters.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz: string = DEFAULT_TZ): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Độ lệch (phút) của múi giờ so với UTC tại thời điểm cho trước. */
export function tzOffsetMinutes(date: Date, tz: string = DEFAULT_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Giờ địa phương (ngày + giờ) tại múi giờ → thời điểm tuyệt đối. Hỗ trợ '24:00'. */
export function zonedToUtc(dateKey: string, time: string, tz: string = DEFAULT_TZ): Date {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  let result = guess - offset * 60000;
  const corrected = tzOffsetMinutes(new Date(result), tz);
  if (corrected !== offset) result = guess - corrected * 60000;
  return new Date(result);
}

export function dateKeyInZone(date: Date, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function timeInZone(date: Date, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Thời điểm xử lý request. Server Component chỉ render một lần mỗi request nên đọc giờ ở đây là ổn định;
 * Client Component phải dùng hook (useMinuteClock) thay vì gọi hàm này trong lúc render.
 */
export function requestNow(): number {
  return Date.now();
}

export function todayKey(tz: string = DEFAULT_TZ): string {
  return dateKeyInZone(new Date(), tz);
}

export function addDays(dateKey: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Thứ trong tuần theo ISO: 1 = Thứ 2 … 7 = Chủ nhật. */
export function isoWeekday(dateKey: string): number {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Thứ 2 của tuần chứa ngày. */
export function startOfIsoWeek(dateKey: string): string {
  return addDays(dateKey, 1 - isoWeekday(dateKey));
}

export function monthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonths(monthStart: string, months: number): string {
  const [y = 1970, m = 1] = monthStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
}

export function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** 'HH:mm:ss' → 'HH:mm' */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** '2026-10-19 11:00:00+00' → '2026-10-19T11:00:00+00:00' (định dạng JS Date đọc được) */
function toIsoInstant(value: string): string {
  const iso = value.trim().replace(' ', 'T');
  return /[+-]\d{2}$/.test(iso) ? `${iso}:00` : iso;
}

/** Đọc khoảng tstzrange của PostgREST: '["2026-10-19 11:00:00+00","2026-10-19 13:00:00+00")' */
export function parseTstzRange(range: string): { start: Date; end: Date } | null {
  const match = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(range.trim());
  if (!match?.[1] || !match[2]) return null;
  const start = new Date(toIsoInstant(match[1]));
  const end = new Date(toIsoInstant(match[2]));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}
