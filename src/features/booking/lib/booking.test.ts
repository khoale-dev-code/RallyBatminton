import { describe, expect, it } from 'vitest';

import { formatDaysMask } from '@/lib/format';
import { normalizeVnPhone } from '@/lib/phone';
import { addDays, isoWeekday, parseTstzRange, zonedToUtc } from '@/lib/time';

import { depositFor, quoteSlots, ruleForSlot, type PriceRuleLite } from './pricing';
import { buildDaySlots, nextSelection } from './slots';

const rule = (over: Partial<PriceRuleLite>): PriceRuleLite => ({
  id: 'r',
  court_id: null,
  days_mask: 127,
  starts_at: '06:00:00',
  ends_at: '23:00:00',
  price_per_hour: 80000,
  priority: 0,
  valid_from: null,
  valid_until: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('slots', () => {
  it('builds 30-minute slots across opening hours', () => {
    const slots = buildDaySlots('06:00:00', '23:00:00', 30);
    expect(slots).toHaveLength(34);
    expect(slots[0]).toMatchObject({ start: '06:00', end: '06:30' });
    expect(slots.at(-1)).toMatchObject({ start: '22:30', end: '23:00' });
  });

  it('supports closing at 24:00', () => {
    expect(buildDaySlots('22:00', '24:00', 30).at(-1)?.end).toBe('24:00');
  });

  it('selects minimum length, extends, shrinks and clears', () => {
    const rules = { slotCount: 10, minSlots: 2, maxSlots: 4, isBlocked: (i: number) => i === 6 };
    let sel = nextSelection(null, 'c1', 1, rules);
    expect(sel).toEqual({ courtId: 'c1', startIndex: 1, endIndex: 2 });
    sel = nextSelection(sel, 'c1', 4, rules);
    expect(sel).toEqual({ courtId: 'c1', startIndex: 1, endIndex: 4 });
    sel = nextSelection(sel, 'c1', 5, rules); // vượt tối đa 4 ô → bắt đầu lại
    expect(sel).toEqual({ courtId: 'c1', startIndex: 5, endIndex: 5 }); // ô 6 bận nên không đủ 2 ô
    sel = nextSelection({ courtId: 'c1', startIndex: 1, endIndex: 4 }, 'c1', 3, rules);
    expect(sel?.endIndex).toBe(3);
    expect(nextSelection(sel, 'c1', 1, rules)).toBeNull();
    expect(nextSelection(sel, 'c1', 6, rules)).toBe(sel); // ô bận không đổi
  });
});

describe('pricing', () => {
  const rules = [
    rule({ id: 'day', starts_at: '06:00', ends_at: '17:00', price_per_hour: 80000 }),
    rule({ id: 'gold', starts_at: '17:00', ends_at: '23:00', price_per_hour: 120000 }),
    rule({ id: 'vip', court_id: 'c2', starts_at: '17:00', ends_at: '23:00', price_per_hour: 150000 }),
    rule({ id: 'weekend', days_mask: 96, starts_at: '06:00', ends_at: '17:00', price_per_hour: 100000, priority: 5 }),
  ];

  it('prefers court-specific rule, then priority', () => {
    expect(ruleForSlot(rules, 'c2', '2026-10-19', '18:00', 30)?.id).toBe('vip');
    expect(ruleForSlot(rules, 'c1', '2026-10-19', '18:00', 30)?.id).toBe('gold');
    expect(ruleForSlot(rules, 'c1', '2026-10-24', '09:00', 30)?.id).toBe('weekend'); // thứ bảy
    expect(ruleForSlot(rules, 'c1', '2026-10-19', '23:00', 30)).toBeNull();
  });

  it('quotes like the database: 16:00–18:00 = 80k + 120k', () => {
    const q = quoteSlots(rules, 'c1', '2026-10-19', ['16:00', '16:30', '17:00', '17:30'], 30, 30);
    expect(q).toEqual({ total: 200000, deposit: 60000, complete: true });
    expect(depositFor(240000, 30)).toBe(72000);
  });

  it('respects validity dates', () => {
    const promo = rule({ id: 'promo', priority: 9, valid_from: '2026-10-20', valid_until: '2026-10-21', price_per_hour: 50000 });
    expect(ruleForSlot([...rules, promo], 'c1', '2026-10-19', '09:00', 30)?.id).toBe('day');
    expect(ruleForSlot([...rules, promo], 'c1', '2026-10-20', '09:00', 30)?.id).toBe('promo');
  });
});

describe('helpers', () => {
  it('normalizes Vietnamese phones', () => {
    expect(normalizeVnPhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
    expect(normalizeVnPhone('0212345678')).toBeNull();
  });

  it('formats day masks', () => {
    expect(formatDaysMask(127)).toBe('Cả tuần');
    expect(formatDaysMask(31)).toBe('T2–T6');
    expect(formatDaysMask(96)).toBe('T7, CN');
    expect(formatDaysMask(1 | 4)).toBe('T2, T4');
  });

  it('converts local Vietnam time to UTC', () => {
    expect(zonedToUtc('2026-10-19', '18:00', 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-10-19T11:00:00.000Z');
    expect(zonedToUtc('2026-10-19', '24:00', 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-10-19T17:00:00.000Z');
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('parses PostgREST ranges', () => {
    const r = parseTstzRange('["2026-10-19 11:00:00+00","2026-10-19 13:00:00+00")');
    expect(r?.start.toISOString()).toBe('2026-10-19T11:00:00.000Z');
    expect(r?.end.toISOString()).toBe('2026-10-19T13:00:00.000Z');
  });
});
