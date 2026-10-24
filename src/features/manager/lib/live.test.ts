import { describe, expect, it } from 'vitest';

import { hasNewVersion, isIos, isLivePath } from './live';

describe('Rally Manager', () => {
  it('chỉ làm mới các trang vận hành khi lịch sân đổi', () => {
    expect(isLivePath('/admin')).toBe(true);
    expect(isLivePath('/admin/bookings')).toBe(true);
    expect(isLivePath('/admin/bookings/abc')).toBe(true);
    expect(isLivePath('/admin/checkout')).toBe(true);
    expect(isLivePath('/admin/settings')).toBe(false);
    expect(isLivePath('/admin/bookingsx')).toBe(false);
    expect(isLivePath('/booking')).toBe(false);
  });
  it('nhận ra phiên bản mới trên máy chủ', () => {
    expect(hasNewVersion('a', { build: 'b' })).toBe(true);
    expect(hasNewVersion('a', { build: 'a' })).toBe(false);
    expect(hasNewVersion('a', { build: 'unknown' })).toBe(false);
    expect(hasNewVersion(undefined, { build: 'b' })).toBe(false);
    expect(hasNewVersion('a', null)).toBe(false);
    expect(hasNewVersion('a', { foo: 1 })).toBe(false);
  });
  it('nhận ra iPhone / iPad', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
});
