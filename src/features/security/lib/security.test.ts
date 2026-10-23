import { describe, expect, it } from 'vitest';

import { eventHeadline, securityAlertHtml, securityAlertSubject, type SecurityEventItem } from './events';
import { limitsSchema, lockMessage, totpCodeSchema } from './settings';

const base: SecurityEventItem = {
  id: '1',
  kind: 'booking_branch_cap',
  severity: 'critical',
  subject: 'Rally <Quận 7>',
  occurrences: 3,
  first_seen_at: '2026-10-23T10:00:00Z',
  last_seen_at: '2026-10-23T10:20:00Z',
  branch_name: null,
};

describe('email cảnh báo bảo mật', () => {
  it('tiêu đề khẩn khi có sự kiện nghiêm trọng, đếm số lần', () => {
    expect(securityAlertSubject([base])).toMatch(/^\[Rally\] KHẨN — Chi nhánh chạm giới hạn/);
    expect(eventHeadline(base)).toContain('(3 lần)');
    expect(securityAlertSubject([base, { ...base, id: '2', severity: 'warning' }])).toContain('2 cảnh báo');
  });
  it('thoát ký tự HTML trong nội dung', () => {
    const html = securityAlertHtml([base], 'https://rally.vn/admin/security');
    expect(html).toContain('Rally &lt;Quận 7&gt;');
    expect(html).not.toContain('<Quận 7>');
  });
});

describe('cài đặt bảo mật', () => {
  const ok = {
    client_max_active_holds: 3,
    client_max_holds_per_hour: 6,
    client_max_phones_per_day: 4,
    abandon_window_days: 7,
    phone_elevated_after: 2,
    elevated_hold_minutes: 7,
    phone_block_after: 5,
    hold_cap_per_court: 3,
    hold_cap_min: 6,
    login_max_failures: 5,
    login_lock_minutes: 15,
    login_ip_max_failures: 30,
  };
  it('mức chặn phải lớn hơn mức giới hạn', () => {
    expect(limitsSchema.safeParse(ok).success).toBe(true);
    expect(limitsSchema.safeParse({ ...ok, phone_block_after: 2 }).success).toBe(false);
    expect(limitsSchema.safeParse({ ...ok, elevated_hold_minutes: 3 }).success).toBe(false);
  });
  it('mã 6 số, cho phép khoảng trắng', () => {
    expect(totpCodeSchema.parse('123 456')).toBe('123456');
    expect(totpCodeSchema.safeParse('12345').success).toBe(false);
    expect(totpCodeSchema.safeParse('abcdef').success).toBe(false);
  });
  it('thông báo khóa làm tròn lên phút', () => {
    expect(lockMessage(61)).toContain('2 phút');
    expect(lockMessage(5)).toContain('1 phút');
  });
});
