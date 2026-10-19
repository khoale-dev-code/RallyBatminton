import { describe, expect, it } from 'vitest';

import { barHeights, percentChange, shares, tickIndexes } from './metrics';

describe('percentChange', () => {
  it('tính % tăng giảm, null khi kỳ trước = 0', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe('shares', () => {
  it('bỏ phần âm/0, sắp giảm dần, cộng ~100%', () => {
    const s = shares({ cash: 300, bank_transfer: 600, card: 0, gateway: 100, e_wallet: -50 });
    expect(s.map((x) => x.key)).toEqual(['bank_transfer', 'cash', 'gateway']);
    expect(s.map((x) => x.percent)).toEqual([60, 30, 10]);
  });
});

describe('barHeights', () => {
  it('cùng thang theo ngày cao nhất', () => {
    const { max, bars } = barHeights([
      { day: 'a', booking: 100, sale: 50, rental: 50, refund: 0 },
      { day: 'b', booking: 50, sale: 0, rental: 0, refund: 20 },
    ]);
    expect(max).toBe(200);
    expect(bars[0]?.h).toEqual({ booking: 50, sale: 25, rental: 25 });
    expect(bars[1]?.total).toBe(50);
  });
  it('không chia cho 0 khi chưa có tiền', () => {
    expect(barHeights([{ day: 'a', booking: 0, sale: 0, rental: 0, refund: 0 }]).bars[0]?.h.booking).toBe(0);
  });
});

describe('tickIndexes', () => {
  it('luôn có mốc đầu và cuối, không trùng', () => {
    expect(tickIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const t30 = tickIndexes(30);
    expect(t30[0]).toBe(0);
    expect(t30.at(-1)).toBe(29);
    expect(new Set(t30).size).toBe(t30.length);
    expect(t30.length).toBeLessThanOrEqual(8);
    expect(tickIndexes(0)).toEqual([]);
  });
});
