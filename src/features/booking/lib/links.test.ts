import { describe, expect, it } from 'vitest';

import { bookingHref } from './links';

describe('bookingHref', () => {
  it('trang Đặt sân trống', () => {
    expect(bookingHref()).toBe('/booking');
  });
  it('chọn sẵn chi nhánh', () => {
    expect(bookingHref('rally-quan-7')).toBe('/booking?branch=rally-quan-7');
  });
  it('kèm ngày + giờ thì nhảy tới lưới giờ', () => {
    expect(bookingHref('rally-quan-7', { date: '2026-10-20', time: '18:00' })).toBe(
      '/booking?branch=rally-quan-7&date=2026-10-20&time=18%3A00#chon-gio',
    );
  });
  it('bỏ giờ khi không có ngày', () => {
    expect(bookingHref('a', { time: '18:00' })).toBe('/booking?branch=a');
  });
});
