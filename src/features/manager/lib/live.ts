/** Trang quản trị cần làm mới ngay khi lịch sân thay đổi (khách đặt online, SePay xác nhận cọc, nhân viên khác thao tác). */
const LIVE_PREFIXES = ['/admin/bookings', '/admin/checkout'];

export function isLivePath(pathname: string): boolean {
  return pathname === '/admin' || LIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Ẩn cửa sổ lâu hơn mức này thì khi quay lại tự tải dữ liệu mới (vd. để máy quầy qua đêm). */
export const STALE_AFTER_HIDDEN_MS = 2 * 60_000;

/** Đang chạy dạng ứng dụng đã cài (cửa sổ riêng), không phải tab trình duyệt. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Thiết bị iPhone / iPad (Safari không có nút cài tự động — phải dùng "Thêm vào MH chính"). */
export function isIos(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && /mobile/i.test(userAgent));
}

/** Máy chủ đã chạy phiên bản khác phiên bản ứng dụng đang mở. */
export function hasNewVersion(current: string | undefined, server: unknown): boolean {
  if (!current || typeof server !== 'object' || server === null || !('build' in server)) return false;
  const build = (server as { build: unknown }).build;
  return typeof build === 'string' && build !== 'unknown' && build !== current;
}
