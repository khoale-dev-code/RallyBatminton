/**
 * Đơn đã đặt / đã tra cứu trên THIẾT BỊ NÀY (localStorage) — giúp khách vãng lai mở lại đơn
 * mà không cần nhớ mã. Chỉ nằm trên máy của khách, không gửi lên máy chủ.
 */
export interface RecentBooking {
  code: string;
  phone: string;
  startsAt: string;
  branchName: string;
  courtName: string;
  savedAt: string;
}

export const RECENT_BOOKINGS_KEY = 'rally.recent-bookings';
export const RECENT_BOOKINGS_LIMIT = 8;

function isRecentBooking(value: unknown): value is RecentBooking {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === 'string' &&
    /^[A-Z0-9-]{6,20}$/.test(v.code) &&
    typeof v.phone === 'string' &&
    typeof v.startsAt === 'string' &&
    typeof v.branchName === 'string' &&
    typeof v.courtName === 'string' &&
    typeof v.savedAt === 'string'
  );
}

/** Đọc an toàn: dữ liệu hỏng / sai dạng bị bỏ qua. */
export function parseRecentBookings(raw: string | null): RecentBooking[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentBooking).slice(0, RECENT_BOOKINGS_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Thêm / đưa lên đầu (trùng mã thì cập nhật), giữ tối đa RECENT_BOOKINGS_LIMIT đơn. */
export function upsertRecentBooking(list: RecentBooking[], entry: RecentBooking): RecentBooking[] {
  return [entry, ...list.filter((b) => b.code !== entry.code)].slice(0, RECENT_BOOKINGS_LIMIT);
}

export function removeRecentBooking(list: RecentBooking[], code: string): RecentBooking[] {
  return list.filter((b) => b.code !== code);
}

/** Sắp tới trước (gần nhất lên đầu), sau đó các đơn đã qua (mới nhất lên đầu). */
export function sortRecentBookings(list: RecentBooking[], nowMs: number): RecentBooking[] {
  const upcoming = list.filter((b) => Date.parse(b.startsAt) >= nowMs).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = list.filter((b) => Date.parse(b.startsAt) < nowMs).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return [...upcoming, ...past];
}

// --- Lưu trữ trình duyệt (bọc try/catch: chế độ ẩn danh / chặn lưu trữ vẫn chạy bình thường) ---
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: RecentBooking[] } = { raw: null, list: [] };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RECENT_BOOKINGS_KEY);
  } catch {
    return null;
  }
}

export function loadRecentBookings(): RecentBooking[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, list: parseRecentBookings(raw) };
  return cache.list;
}

function save(list: RecentBooking[]) {
  try {
    window.localStorage.setItem(RECENT_BOOKINGS_KEY, JSON.stringify(list));
  } catch {
    // Không lưu được (ẩn danh / đầy bộ nhớ): bỏ qua.
  }
  for (const l of listeners) l();
}

export function rememberBooking(entry: Omit<RecentBooking, 'savedAt'>) {
  save(upsertRecentBooking(loadRecentBookings(), { ...entry, savedAt: new Date().toISOString() }));
}

export function forgetBooking(code: string) {
  save(removeRecentBooking(loadRecentBookings(), code));
}

export function subscribeRecentBookings(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECENT_BOOKINGS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
