import { describe, expect, it } from 'vitest';

import { buildPlan, expandDates, spanDays, templatesFrom } from './plan';

const tz = 'Asia/Ho_Chi_Minh';

describe('xếp ca nhiều ngày', () => {
  it('lọc ngày theo thứ đã chọn', () => {
    // 19/10/2026 là thứ Hai
    expect(expandDates('2026-10-19', '2026-10-25', [1, 2, 3, 4, 5])).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
    expect(expandDates('2026-10-19', '2026-10-25', [6, 7])).toEqual(['2026-10-24', '2026-10-25']);
    expect(expandDates('2026-10-25', '2026-10-19', [1])).toEqual([]);
    expect(spanDays('2026-10-19', '2026-10-25')).toBe(7);
  });

  it('nhiều nhân viên × nhiều ngày, đánh dấu ca trùng', () => {
    const plan = buildPlan({
      employeeIds: ['huy', 'bao'],
      dates: ['2026-10-20', '2026-10-21'],
      start: '06:00',
      end: '14:00',
      breakMinutes: 30,
      tz,
      existing: [{ employeeId: 'bao', start: '2026-10-21T05:30:00+07:00', end: '2026-10-21T13:30:00+07:00' }],
    });
    expect(plan.error).toBeNull();
    expect(plan.items).toHaveLength(4);
    expect(plan.items.filter((i) => i.conflict).map((i) => `${i.employeeId} ${i.workDate}`)).toEqual(['bao 2026-10-21']);
    expect(plan.paidMinutes).toBe(450);
  });

  it('ca qua nửa đêm và các lỗi khung giờ', () => {
    const night = buildPlan({
      employeeIds: ['a'],
      dates: ['2026-10-20', '2026-10-21'],
      start: '22:00',
      end: '06:00',
      breakMinutes: 0,
      tz,
      existing: [],
    });
    expect(night.overnight).toBe(true);
    expect(night.minutes).toBe(480);
    expect(night.items[0]?.endsAt.toISOString()).toBe('2026-10-20T23:00:00.000Z');
    expect(
      buildPlan({ employeeIds: ['a'], dates: ['2026-10-20'], start: '06:00', end: '06:00', breakMinutes: 0, tz, existing: [] }).error,
    ).toBeTruthy();
    expect(
      buildPlan({ employeeIds: ['a'], dates: ['2026-10-20'], start: '05:00', end: '22:00', breakMinutes: 0, tz, existing: [] }).error,
    ).toBe('Ca tối đa 16 giờ.');
    expect(
      buildPlan({ employeeIds: ['a'], dates: ['2026-10-20'], start: '06:00', end: '07:00', breakMinutes: 60, tz, existing: [] }).error,
    ).toBe('Giờ nghỉ phải ngắn hơn ca.');
  });

  it('ca mới chồng nhau trong cùng lần xếp cũng bị chặn', () => {
    const plan = buildPlan({
      employeeIds: ['a'],
      dates: ['2026-10-20', '2026-10-21'],
      start: '18:00',
      end: '10:00',
      breakMinutes: 0,
      tz,
      existing: [],
    });
    expect(plan.items.map((i) => i.conflict)).toEqual([false, false]);
    const overlap = buildPlan({
      employeeIds: ['a'],
      dates: ['2026-10-20', '2026-10-21'],
      start: '12:00',
      end: '04:00',
      breakMinutes: 0,
      tz,
      existing: [],
    });
    expect(overlap.items.map((i) => i.conflict)).toEqual([false, false]);
  });

  it('mẫu ca hay dùng đứng trước mẫu mặc định', () => {
    const t = templatesFrom([
      { start: '05:30', end: '13:30' },
      { start: '05:30', end: '13:30' },
      { start: '06:00', end: '14:00' },
    ]);
    expect(t[0]).toMatchObject({ start: '05:30', end: '13:30', label: 'Hay dùng' });
    expect(t.filter((x) => x.start === '06:00' && x.end === '14:00')).toHaveLength(1);
  });
});
