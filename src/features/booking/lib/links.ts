/** Đường dẫn trang Đặt sân, chọn sẵn chi nhánh / ngày / giờ (nhảy tới lưới giờ khi đã chọn ngày). */
export function bookingHref(slug?: string | null, options: { date?: string | null; time?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (slug) q.set('branch', slug);
  if (options.date) q.set('date', options.date);
  if (options.date && options.time) q.set('time', options.time);
  const query = q.toString();
  return `/booking${query ? `?${query}` : ''}${options.date ? '#chon-gio' : ''}`;
}
