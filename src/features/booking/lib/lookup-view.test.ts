import { describe, expect, it } from 'vitest';

import { bookingJourney, bookingWhen, canGuestCancel, directionsUrl, groupPhoneBookings, paymentProgress } from './lookup-view';

describe('bookingJourney', () => {
  it('đặt đúng mốc cho đơn đang chạy', () => {
    expect(bookingJourney('held')).toEqual({ kind: 'progress', reached: 0 });
    expect(bookingJourney('confirmed')).toEqual({ kind: 'progress', reached: 1 });
    expect(bookingJourney('completed')).toEqual({ kind: 'progress', reached: 3 });
  });

  it('dừng hành trình với đơn hủy / hết hạn / không đến', () => {
    expect(bookingJourney('cancelled')).toEqual({ kind: 'stopped', status: 'cancelled' });
    expect(bookingJourney('no_show')).toEqual({ kind: 'stopped', status: 'no_show' });
  });
});

describe('bookingWhen', () => {
  it('hiển thị theo giờ Việt Nam, kể cả khi qua nửa đêm UTC', () => {
    const when = bookingWhen('2026-10-25T15:30:00Z', '2026-10-25T17:00:00Z');
    expect(when).toEqual({
      weekday: 'Chủ nhật',
      dayMonth: '25/10',
      year: '2026',
      timeRange: '22:30 – 00:00',
      duration: '1 giờ 30 phút',
    });
  });
});

describe('paymentProgress', () => {
  it('tính phần trăm và số còn lại', () => {
    expect(paymentProgress(140000, 42000)).toEqual({ percent: 30, remaining: 98000, settled: false });
    expect(paymentProgress(140000, 140000)).toEqual({ percent: 100, remaining: 0, settled: true });
  });

  it('không vượt 100% khi trả dư', () => {
    expect(paymentProgress(100000, 120000).percent).toBe(100);
  });
});

describe('canGuestCancel', () => {
  const start = '2026-10-25T15:00:00Z';
  const before = Date.parse('2026-10-25T14:00:00Z');
  it('cho hủy trước giờ chơi khi đơn còn hiệu lực', () => {
    expect(canGuestCancel('confirmed', start, before)).toBe(true);
    expect(canGuestCancel('held', start, before)).toBe(true);
  });
  it('không cho hủy sau giờ bắt đầu hoặc khi đơn đã kết thúc', () => {
    expect(canGuestCancel('confirmed', start, Date.parse('2026-10-25T15:01:00Z'))).toBe(false);
    expect(canGuestCancel('checked_in', start, before)).toBe(false);
    expect(canGuestCancel('cancelled', start, before)).toBe(false);
  });
});

describe('directionsUrl', () => {
  it('mã hóa tên và địa chỉ', () => {
    expect(directionsUrl('Rally Q7', '12 Nguyễn Thị Thập')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rally%20Q7%2C%2012%20Nguy%E1%BB%85n%20Th%E1%BB%8B%20Th%E1%BA%ADp',
    );
  });
});

describe('groupPhoneBookings', () => {
  // 19/10/2026 14:00 giờ Việt Nam
  const now = Date.parse('2026-10-19T07:00:00Z');
  const items = [
    { id: 'past-1', starts_at: '2026-10-10T12:00:00Z' },
    { id: 'late-today', starts_at: '2026-10-19T15:30:00Z' }, // 22:30 hôm nay (VN), đã qua ngày UTC thì vẫn là hôm nay
    { id: 'next', starts_at: '2026-10-20T03:00:00Z' },
    { id: 'early-today', starts_at: '2026-10-19T00:30:00Z' }, // 07:30 hôm nay, đã chơi xong vẫn thuộc Hôm nay
    { id: 'past-2', starts_at: '2026-10-18T12:00:00Z' },
    { id: 'after-midnight-vn', starts_at: '2026-10-19T17:30:00Z' }, // 00:30 ngày 20 (VN)
  ];

  it('chia đúng nhóm theo ngày giờ Việt Nam và sắp xếp', () => {
    const groups = groupPhoneBookings(items, now);
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['today', ['early-today', 'late-today']],
      ['upcoming', ['after-midnight-vn', 'next']],
      ['past', ['past-2', 'past-1']],
    ]);
    expect(groups[2]?.title).toBe('Lịch sử đặt sân');
  });

  it('bỏ nhóm rỗng', () => {
    expect(groupPhoneBookings([{ starts_at: '2026-10-19T03:00:00Z' }], now).map((g) => g.key)).toEqual(['today']);
    expect(groupPhoneBookings([], now)).toEqual([]);
  });
});
