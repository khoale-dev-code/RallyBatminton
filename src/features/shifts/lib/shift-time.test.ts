import { describe, expect, it } from 'vitest';

import { localInputToUtc, plannedMinutes, shiftWindow } from './shift-time';

const TZ = 'Asia/Ho_Chi_Minh';

describe('shiftWindow', () => {
  it('ca trong ngày', () => {
    const w = shiftWindow('2026-10-17', '08:00', '16:00', TZ);
    expect(w.overnight).toBe(false);
    expect(w.startsAt.toISOString()).toBe('2026-10-17T01:00:00.000Z');
    expect(w.minutes).toBe(480);
  });

  it('ca qua nửa đêm kết thúc ngày hôm sau', () => {
    const w = shiftWindow('2026-10-17', '18:00', '02:00', TZ);
    expect(w.overnight).toBe(true);
    expect(w.endsAt.toISOString()).toBe('2026-10-17T19:00:00.000Z');
    expect(w.minutes).toBe(480);
  });
});

describe('plannedMinutes & localInputToUtc', () => {
  it('trừ giờ nghỉ', () => {
    expect(plannedMinutes('2026-10-17T01:00:00Z', '2026-10-17T09:00:00Z', 30)).toBe(450);
  });
  it('đổi giờ địa phương sang UTC', () => {
    expect(localInputToUtc('2026-10-17T07:30', TZ)?.toISOString()).toBe('2026-10-17T00:30:00.000Z');
    expect(localInputToUtc('17/10/2026', TZ)).toBeNull();
  });
});
