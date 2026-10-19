/**
 * Thuế bán hàng (Việt Nam) — dùng chung cho màn sản phẩm, quầy bán và đơn bán.
 *
 * - Khấu trừ (doanh nghiệp): giá bán ĐÃ GỒM VAT; tiền VAT = thành tiền × r / (100 + r).
 * - Trực tiếp (hộ kinh doanh): thuế = tỷ lệ % × doanh thu theo nhóm ngành nghề (GTGT + TNCN),
 *   Thông tư 40/2021/TT-BTC. Database tính lại và chụp vào từng dòng bán (trigger sale_lines_tax).
 */

export type TaxMethod = 'deduction' | 'direct';
export type TaxIndustry = 'goods' | 'service' | 'rental' | 'production' | 'other';

export const TAX_METHODS: Array<{ value: TaxMethod; label: string; hint: string }> = [
  { value: 'deduction', label: 'Khấu trừ', hint: 'Doanh nghiệp kê khai VAT. Giá bán đã gồm thuế GTGT.' },
  { value: 'direct', label: 'Trực tiếp', hint: 'Hộ kinh doanh nộp thuế theo tỷ lệ % trên doanh thu.' },
];

export const TAX_INDUSTRIES: Array<{ value: TaxIndustry; label: string; vat: number; pit: number }> = [
  { value: 'goods', label: 'Phân phối, cung cấp hàng hóa', vat: 1, pit: 0.5 },
  { value: 'service', label: 'Dịch vụ, xây dựng không bao thầu nguyên vật liệu', vat: 5, pit: 2 },
  { value: 'rental', label: 'Hoạt động cho thuê tài sản trừ bất động sản', vat: 5, pit: 5 },
  { value: 'production', label: 'Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu nguyên vật liệu', vat: 3, pit: 1.5 },
  { value: 'other', label: 'Hoạt động kinh doanh khác', vat: 2, pit: 1 },
];

/** Mức VAT thường gặp (%): 0, 5, 8 (giảm 2% theo chính sách hiện hành), 10. */
export const VAT_PRESETS = [0, 5, 8, 10] as const;

export interface BrandTax {
  method: TaxMethod;
  defaultVatRate: number;
}

export interface ProductTax {
  taxable: boolean;
  industry: TaxIndustry | null;
  vatUseDefault: boolean;
  vatRate: number | null;
}

/** Thuế áp cho một sản phẩm theo cách tính của thương hiệu; null = không tính thuế. */
export interface EffectiveTax {
  method: TaxMethod;
  vatRate: number;
  pitRate: number;
}

export const DEFAULT_BRAND_TAX: BrandTax = { method: 'deduction', defaultVatRate: 8 };

export function isTaxMethod(v: unknown): v is TaxMethod {
  return v === 'deduction' || v === 'direct';
}

export function isTaxIndustry(v: unknown): v is TaxIndustry {
  return TAX_INDUSTRIES.some((i) => i.value === v);
}

export function industryOf(code: TaxIndustry | null): (typeof TAX_INDUSTRIES)[number] {
  return TAX_INDUSTRIES.find((i) => i.value === code) ?? TAX_INDUSTRIES[TAX_INDUSTRIES.length - 1]!;
}

export function effectiveTax(product: ProductTax, brand: BrandTax): EffectiveTax | null {
  if (!product.taxable) return null;
  if (brand.method === 'deduction') {
    const rate = product.vatUseDefault ? brand.defaultVatRate : (product.vatRate ?? brand.defaultVatRate);
    return { method: 'deduction', vatRate: rate, pitRate: 0 };
  }
  const group = industryOf(product.industry);
  return { method: 'direct', vatRate: group.vat, pitRate: group.pit };
}

/** Tiền thuế của một khoản tiền (làm tròn như database: nửa đơn vị làm tròn lên). */
export function taxOfAmount(amount: number, tax: EffectiveTax | null): { vat: number; pit: number } {
  if (!tax || amount <= 0) return { vat: 0, pit: 0 };
  if (tax.method === 'deduction') return { vat: Math.round((amount * tax.vatRate) / (100 + tax.vatRate)), pit: 0 };
  return { vat: Math.round((amount * tax.vatRate) / 100), pit: Math.round((amount * tax.pitRate) / 100) };
}

/** 0.5 → "0,5%", 8 → "8%" */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
}

/** Mô tả ngắn: "VAT 8%", "GTGT 1% | TNCN 0,5%", "Không chịu thuế". */
export function taxLabel(tax: EffectiveTax | null): string {
  if (!tax) return 'Không chịu thuế';
  return tax.method === 'deduction'
    ? `VAT ${formatPercent(tax.vatRate)}`
    : `GTGT ${formatPercent(tax.vatRate)} | TNCN ${formatPercent(tax.pitRate)}`;
}
