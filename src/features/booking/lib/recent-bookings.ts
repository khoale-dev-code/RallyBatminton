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
/** Tối thiểu hóa dữ liệu trên thiết bị: tự xóa 30 ngày sau giờ chơi (và mọi mục lưu quá 90 ngày). */
export const RECENT_BOOKINGS_TTL_DAYS = 30;
const SAVED_MAX_DAYS = 90;

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

/** Bỏ các đơn đã qua giờ chơi quá 30 ngày hoặc đã lưu quá 90 ngày. */
export function pruneRecentBookings(list: RecentBooking[], nowMs: number): RecentBooking[] {
  const day = 86_400_000;
  return list.filter((b) => {
    const starts = Date.parse(b.startsAt);
    const saved = Date.parse(b.savedAt);
    return (
      (Number.isNaN(starts) || starts >= nowMs - RECENT_BOOKINGS_TTL_DAYS * day) &&
      (Number.isNaN(saved) || saved >= nowMs - SAVED_MAX_DAYS * day)
    );
  });
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
  if (raw !== cache.raw) {
    const parsed = parseRecentBookings(raw);
    const kept = pruneRecentBookings(parsed, Date.now());
    cache = { raw, list: kept };
    if (kept.length !== parsed.length) {
      // Ghi lại bản đã dọn (không báo listener — đang trong lúc đọc).
      try {
        const next = kept.length > 0 ? JSON.stringify(kept) : null;
        if (next) window.localStorage.setItem(RECENT_BOOKINGS_KEY, next);
        else window.localStorage.removeItem(RECENT_BOOKINGS_KEY);
        cache = { raw: next, list: kept };
      } catch {
        // Không ghi được: vẫn ẩn các mục hết hạn.
      }
    }
  }
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

/** Xóa toàn bộ đơn đã lưu trên thiết bị này. */
export function forgetAllBookings() {
  try {
    window.localStorage.removeItem(RECENT_BOOKINGS_KEY);
  } catch {
    // Bộ nhớ bị chặn: không có gì để xóa.
  }
  for (const l of listeners) l();
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
