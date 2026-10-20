import { describe, expect, it } from 'vitest';

import { canRequestFix, claimToInstant, lateMinutes, lateOutMinutes, paidWindow } from './rules';

const TZ = 'Asia/Ho_Chi_Minh';
// Ca 06:00–14:00 giờ Việt Nam ngày 20/10/2026 (UTC+7)
const shift = { scheduled_start: '2026-10-19T23:00:00Z', scheduled_end: '2026-10-20T07:00:00Z' };
const min = (a: number, b: number) => Math.round((b - a) / 60_000);

describe('quy tắc công (khớp SQL 21)', () => {
  it('đến sớm không tính thêm; quên ra rồi quay lại quét không tính thêm', () => {
    const w = paidWindow({ ...shift, checked_in_at: '2026-10-19T22:30:00Z', checked_out_at: '2026-10-20T18:30:00Z' }, 0);
    expect(w && min(w.start, w.end)).toBe(480);
    expect(w?.capped).toBe(true);
  });
  it('tăng ca đã đồng ý nới khung; chủ sân duyệt giờ thực tế bỏ giới hạn', () => {
    const base = { ...shift, checked_in_at: '2026-10-19T23:00:00Z', checked_out_at: '2026-10-20T10:00:00Z' };
    const ot = paidWindow(base, 120);
    expect(ot && min(ot.start, ot.end)).toBe(600);
    const approved = paidWindow({ ...base, actual_time_decision: 'approved' }, 0);
    expect(approved && min(approved.start, approved.end)).toBe(660);
  });
  it('đi trễ chỉ tính khi quá ân hạn; ra ca trễ tính sau khung tăng ca', () => {
    expect(lateMinutes({ ...shift, checked_in_at: '2026-10-19T23:08:00Z' }, 10)).toBe(0);
    expect(lateMinutes({ ...shift, checked_in_at: '2026-10-19T23:15:00Z' }, 10)).toBe(15);
    expect(lateOutMinutes({ ...shift, checked_out_at: '2026-10-20T09:30:00Z' }, 120)).toBe(30);
  });
  it('hạn gửi yêu cầu sửa giờ tính từ giờ kết thúc ca', () => {
    expect(canRequestFix(shift, 24, Date.parse('2026-10-21T06:59:00Z'))).toBe(true);
    expect(canRequestFix(shift, 24, Date.parse('2026-10-21T07:01:00Z'))).toBe(false);
  });
  it('giờ khai HH:MM → đúng ngày, kể cả ca qua nửa đêm', () => {
    expect(claimToInstant('06:00', shift, TZ)?.toISOString()).toBe('2026-10-19T23:00:00.000Z');
    const night = { scheduled_start: '2026-10-20T11:00:00Z', scheduled_end: '2026-10-20T19:00:00Z' }; // 18:00–02:00
    expect(claimToInstant('01:40', night, TZ)?.toISOString()).toBe('2026-10-20T18:40:00.000Z');
    expect(claimToInstant('25:00', shift, TZ)).toBeNull();
  });
});
