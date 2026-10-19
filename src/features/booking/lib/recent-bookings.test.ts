import { describe, expect, it } from 'vitest';

import { parseRecentBookings, removeRecentBooking, sortRecentBookings, upsertRecentBooking, type RecentBooking } from './recent-bookings';

const entry = (code: string, startsAt: string): RecentBooking => ({
  code,
  phone: '0912345678',
  startsAt,
  branchName: 'Rally Q7',
  courtName: 'Sân A',
  savedAt: '2026-10-01T00:00:00Z',
});

describe('parseRecentBookings', () => {
  it('bỏ qua dữ liệu hỏng hoặc sai dạng', () => {
    expect(parseRecentBookings(null)).toEqual([]);
    expect(parseRecentBookings('not json')).toEqual([]);
    expect(parseRecentBookings('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([entry('RB-AAAA1111', '2026-10-20T10:00:00Z'), { code: '<script>' }, 5]);
    expect(parseRecentBookings(raw).map((b) => b.code)).toEqual(['RB-AAAA1111']);
  });
});

describe('upsertRecentBooking', () => {
  it('đưa đơn lên đầu, không trùng, giới hạn 8 đơn', () => {
    let list: RecentBooking[] = [];
    for (let i = 0; i < 10; i++) list = upsertRecentBooking(list, entry(`RB-CODE000${i}`, '2026-10-20T10:00:00Z'));
    expect(list).toHaveLength(8);
    expect(list[0]?.code).toBe('RB-CODE0009');
    list = upsertRecentBooking(list, entry('RB-CODE0005', '2026-10-21T10:00:00Z'));
    expect(list[0]?.code).toBe('RB-CODE0005');
    expect(list.filter((b) => b.code === 'RB-CODE0005')).toHaveLength(1);
    expect(removeRecentBooking(list, 'RB-CODE0005').some((b) => b.code === 'RB-CODE0005')).toBe(false);
  });
});

describe('sortRecentBookings', () => {
  it('sắp tới trước (gần nhất trước), rồi tới đơn đã qua', () => {
    const now = Date.parse('2026-10-19T00:00:00Z');
    const sorted = sortRecentBookings(
      [
        entry('RB-PAST0001', '2026-10-10T10:00:00Z'),
        entry('RB-NEXT0002', '2026-10-25T10:00:00Z'),
        entry('RB-NEXT0001', '2026-10-20T10:00:00Z'),
      ],
      now,
    );
    expect(sorted.map((b) => b.code)).toEqual(['RB-NEXT0001', 'RB-NEXT0002', 'RB-PAST0001']);
  });
});
