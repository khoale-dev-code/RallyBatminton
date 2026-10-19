import { NAV_GROUP_KEYS, type NavGroupKey } from '../nav';

const YEAR = 60 * 60 * 24 * 365;

/** Ghi tùy chọn giao diện vào cookie để lần tải sau server dựng đúng trạng thái (không nhấp nháy). */
export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
}

export function parseClosedGroups(raw: string | undefined): NavGroupKey[] {
  if (!raw) return [];
  const parts = decodeURIComponent(raw).split(',');
  return NAV_GROUP_KEYS.filter((k) => parts.includes(k));
}
