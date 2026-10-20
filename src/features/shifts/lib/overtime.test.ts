import { describe, expect, it } from 'vitest';

import { clockFromMinutes, shiftPhase, shortDuration } from './board';
import { baseHourlyRate, overtimePay, overtimeWorkedMinutes, suggestedOvertimeRate } from './overtime';

const at = (hhmm: string, day = '2026-10-20') => `${day}T${hhmm}:00+07:00`;

describe('tăng ca', () => {
  it('ví dụ: ca 7h–11h giá 25.000, tăng ca 2 giờ giá 30.000', () => {
    const ot = overtimeWorkedMinutes({
      checkedIn: at('07:00'),
      checkedOut: at('13:00'),
      scheduledEnd: at('11:00'),
      approvedMinutes: 120,
      paidMinutes: 360,
    });
    expect(ot).toBe(120);
    const regular = 360 - ot;
    expect(Math.round((25000 * regular) / 60) + overtimePay(ot, 30000)).toBe(160000);
  });

  it('chỉ tính tối đa số phút đã đồng ý; ra sớm thì tính theo thực tế', () => {
    const base = { checkedIn: at('07:00'), scheduledEnd: at('11:00'), approvedMinutes: 120 };
    expect(overtimeWorkedMinutes({ ...base, checkedOut: at('14:30'), paidMinutes: 450 })).toBe(120);
    expect(overtimeWorkedMinutes({ ...base, checkedOut: at('12:30'), paidMinutes: 330 })).toBe(90);
    expect(overtimeWorkedMinutes({ ...base, checkedOut: at('10:45'), paidMinutes: 225 })).toBe(0);
    expect(overtimeWorkedMinutes({ ...base, approvedMinutes: null, checkedOut: at('13:00'), paidMinutes: 360 })).toBe(0);
  });

  it('gợi ý giá tăng ca 150%, quy đổi lương ngày ra giờ', () => {
    expect(suggestedOvertimeRate(25000)).toBe(38000);
    expect(suggestedOvertimeRate(25000, 2)).toBe(50000);
    expect(suggestedOvertimeRate(null)).toBeNull();
    expect(baseHourlyRate({ pay_type: 'daily', hourly_rate: null, daily_rate: 240000, standard_day_minutes: 480 })).toBe(30000);
    expect(baseHourlyRate({ pay_type: 'hourly', hourly_rate: 25000, daily_rate: null })).toBe(25000);
  });
});

describe('bảng lịch ca', () => {
  const shift = {
    status: 'scheduled',
    scheduled_start: at('07:00'),
    scheduled_end: at('11:00'),
    checked_in_at: null,
    checked_out_at: null,
  };
  const now = (hhmm: string) => new Date(at(hhmm)).getTime();

  it('xác định ca đang diễn ra', () => {
    expect(shiftPhase(shift, now('06:00'))).toBe('upcoming');
    expect(shiftPhase(shift, now('08:00'))).toBe('live');
    expect(shiftPhase(shift, now('11:30'))).toBe('done');
    expect(shiftPhase({ ...shift, overtimeMinutes: 60 }, now('11:30'))).toBe('live');
    expect(shiftPhase({ ...shift, checked_in_at: at('07:00') }, now('12:00'))).toBe('live');
    expect(shiftPhase({ ...shift, status: 'absent' }, now('08:00'))).toBe('off');
    expect(clockFromMinutes(1530)).toBe('01:30');
    expect(shortDuration(450)).toBe('7g30');
  });
});
