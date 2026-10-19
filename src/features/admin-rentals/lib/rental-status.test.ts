import { describe, expect, it } from 'vitest';

import { initials, rentalLiveState } from './rental-status';

const policy = { graceMinutes: 10, blockMinutes: 30, blockPrice: 15000, cap: null };
const startsAt = '2026-10-18T12:00:00Z';
const dueAt = '2026-10-18T13:00:00Z';
const at = (iso: string) => new Date(iso).getTime();

describe('rentalLiveState', () => {
  it('còn thời gian / sắp đến hạn', () => {
    expect(rentalLiveState({ startsAt, dueAt, quantity: 1, policy }, at('2026-10-18T12:20:00Z'))).toMatchObject({
      phase: 'ok',
      label: 'Còn 40 phút',
    });
    expect(rentalLiveState({ startsAt, dueAt, quantity: 1, policy }, at('2026-10-18T12:50:00Z')).phase).toBe('soon');
  });

  it('trong ân hạn rồi tính phí', () => {
    expect(rentalLiveState({ startsAt, dueAt, quantity: 1, policy }, at('2026-10-18T13:05:00Z'))).toMatchObject({
      phase: 'grace',
      label: 'Trễ 5 phút · trong ân hạn',
    });
    const late = rentalLiveState({ startsAt, dueAt, quantity: 2, policy }, at('2026-10-18T14:00:00Z'));
    expect(late).toMatchObject({ phase: 'late', label: 'Trễ 1 giờ' });
    expect(late.overtime.fee).toBe(60000);
  });

  it('chữ cái đại diện lấy theo tên', () => {
    expect(initials('Võ Hoàng Vy')).toBe('V');
    expect(initials('  đặng ngọc hân ')).toBe('H');
  });
});
