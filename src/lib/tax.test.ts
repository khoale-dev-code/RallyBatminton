import { describe, expect, it } from 'vitest';

import { effectiveTax, formatPercent, taxLabel, taxOfAmount } from './tax';

const brand = { method: 'deduction' as const, defaultVatRate: 8 };

describe('thuế', () => {
  it('khấu trừ: dùng mức mặc định hoặc mức riêng, tách VAT khỏi giá đã gồm thuế', () => {
    const def = effectiveTax({ taxable: true, industry: null, vatUseDefault: true, vatRate: 10 }, brand);
    expect(def).toEqual({ method: 'deduction', vatRate: 8, pitRate: 0 });
    expect(taxOfAmount(30000, def)).toEqual({ vat: 2222, pit: 0 });
    const own = effectiveTax({ taxable: true, industry: null, vatUseDefault: false, vatRate: 10 }, brand);
    expect(taxOfAmount(15000, own).vat).toBe(1364);
  });
  it('trực tiếp: tỷ lệ theo nhóm ngành nghề trên doanh thu (khớp database)', () => {
    const t = effectiveTax(
      { taxable: true, industry: 'goods', vatUseDefault: true, vatRate: null },
      { method: 'direct', defaultVatRate: 8 },
    );
    expect(taxOfAmount(30000, t)).toEqual({ vat: 300, pit: 150 });
    expect(taxLabel(t)).toBe('GTGT 1% | TNCN 0,5%');
  });
  it('không chịu thuế', () => {
    const t = effectiveTax({ taxable: false, industry: 'goods', vatUseDefault: true, vatRate: null }, brand);
    expect(t).toBeNull();
    expect(taxOfAmount(10000, t)).toEqual({ vat: 0, pit: 0 });
    expect(taxLabel(t)).toBe('Không chịu thuế');
    expect(formatPercent(1.5)).toBe('1,5%');
  });
});
