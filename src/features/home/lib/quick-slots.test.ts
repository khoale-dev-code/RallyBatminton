import { describe, expect, it } from 'vitest';

import { candidateStarts, closeMinutes, isOpenAt, quickSlots } from './quick-slots';

const tz = 'Asia/Ho_Chi_Minh';
const at = (local: string) => new Date(`${local}+07:00`);

describe('quick slots', () => {
  it('đóng cửa 00:00 là nửa đêm', () => {
    expect(closeMinutes('00:00')).toBe(1440);
    expect(closeMinutes('23:30')).toBe(1410);
  });

  it('giờ gợi ý bắt đầu từ giờ tròn kế tiếp', () => {
    expect(candidateStarts('05:30', '23:30', at('2026-10-18T16:20:00'), tz)).toEqual({
      dateKey: '2026-10-18',
      starts: [17 * 60, 18 * 60, 19 * 60, 20 * 60],
    });
  });

  it('cuối ngày chỉ còn giờ vừa đủ 60 phút, hết giờ thì sang ngày mai', () => {
    expect(candidateStarts('05:30', '23:30', at('2026-10-18T21:10:00'), tz).starts).toEqual([22 * 60]);
    expect(candidateStarts('06:00', '22:00', at('2026-10-18T21:30:00'), tz)).toEqual({
      dateKey: '2026-10-19',
      starts: [6 * 60, 7 * 60, 8 * 60, 9 * 60],
    });
  });

  it('đếm sân trống theo các khoảng bận chồng lấn', () => {
    const busy = [
      { courtId: 'a', start: at('2026-10-18T17:00:00'), end: at('2026-10-18T19:00:00') },
      { courtId: 'b', start: at('2026-10-18T17:30:00'), end: at('2026-10-18T18:00:00') },
      { courtId: 'a', start: at('2026-10-18T19:00:00'), end: at('2026-10-18T20:00:00') },
    ];
    expect(quickSlots('2026-10-18', [17 * 60, 18 * 60, 20 * 60], 2, busy, tz)).toEqual([
      { start: '17:00', freeCourts: 0 },
      { start: '18:00', freeCourts: 1 },
      { start: '20:00', freeCourts: 2 },
    ]);
  });

  it('trạng thái mở cửa', () => {
    expect(isOpenAt('05:30', '23:30', at('2026-10-18T05:29:00'), tz)).toBe(false);
    expect(isOpenAt('05:30', '00:00', at('2026-10-18T23:59:00'), tz)).toBe(true);
  });
});
