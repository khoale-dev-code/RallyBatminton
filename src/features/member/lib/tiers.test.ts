import { describe, expect, it } from 'vitest';

import { pointsForAmount, tierDef, tierProgress } from './tiers';

describe('tierProgress', () => {
  it('thành viên mới', () => {
    const p = tierProgress(0);
    expect(p.current.tier).toBe('member');
    expect(p.next?.tier).toBe('silver');
    expect(p.remaining).toBe(300);
    expect(p.percent).toBe(0);
  });

  it('đúng ngưỡng thì lên hạng', () => {
    expect(tierProgress(300).current.tier).toBe('silver');
    expect(tierProgress(999).current.tier).toBe('silver');
    expect(tierProgress(1000).current.tier).toBe('gold');
  });

  it('tính phần trăm trong hạng hiện tại', () => {
    const p = tierProgress(650);
    expect(p.remaining).toBe(350);
    expect(p.percent).toBe(50);
  });

  it('hạng cao nhất không còn mục tiêu', () => {
    expect(tierProgress(5000)).toMatchObject({ next: null, remaining: 0, percent: 100 });
    expect(tierProgress(5000).current.label).toBe('Kim cương');
  });
});

describe('pointsForAmount', () => {
  it('1 điểm / 10.000đ, làm tròn xuống', () => {
    expect(pointsForAmount(140000)).toBe(14);
    expect(pointsForAmount(9999)).toBe(0);
    expect(pointsForAmount(125500)).toBe(12);
  });
});

describe('tierDef', () => {
  it('trả nhãn tiếng Việt', () => {
    expect(tierDef('gold').label).toBe('Vàng');
  });
});

describe('initialsOf', () => {
  it('lấy chữ đầu họ và tên', async () => {
    const { initialsOf } = await import('./initials');
    expect(initialsOf('Nguyễn Văn An')).toBe('NA');
    expect(initialsOf('An')).toBe('A');
    expect(initialsOf('  ')).toBe('R');
  });
});
