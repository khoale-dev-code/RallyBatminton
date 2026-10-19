import { describe, expect, it } from 'vitest';

import { draftFromProduct, newProductDraft, type ProductRecord, type VariantRecord } from './initial-draft';
import { buildVariants, toPayload } from './product-draft';

const product: ProductRecord = {
  kind: 'sale',
  is_bundle: false,
  name: 'Áo thi đấu',
  category_id: null,
  brand_name: 'Rally',
  description: null,
  excerpt: null,
  base_price: 250000,
  compare_at_price: null,
  unit_label: 'cái',
  tags: ['áo'],
  seo_title: null,
  seo_description: null,
  show_on_website: true,
  show_on_pos: true,
  is_active: true,
  invoice_name: null,
  taxable: true,
  tax_industry: 'goods',
  vat_use_default: false,
  vat_rate: 10,
  option1_name: null,
  option2_name: null,
};

const variant = (id: string, size: string | null, color: string | null, isDefault = false): VariantRecord => ({
  id,
  sku: `AO-${size ?? ''}-${color ?? ''}`.toUpperCase(),
  size_label: size,
  color_label: color,
  price_override: null,
  cost_price: 120000,
  barcode: null,
  is_default: isDefault,
  is_active: true,
});

describe('newProductDraft', () => {
  it('bày bán sẵn ở các chi nhánh được giao, đồ thuê có sẵn một gói giá', () => {
    const d = newProductDraft('rental', false, ['b1', 'b2']);
    expect(Object.keys(d.stock)).toEqual(['b1', 'b2']);
    expect(d.stock.b1?.listed).toBe(true);
    expect(d.rates).toHaveLength(1);
    expect(d.variants).toHaveLength(1);
    expect(d.variants[0]?.isDefault).toBe(true);
  });
});

describe('draftFromProduct', () => {
  it('nhận ra biến thể và không sinh tổ hợp chưa từng có khi thêm size', () => {
    const d = draftFromProduct(product, [variant('v1', 'M', 'Đỏ', true), variant('v2', 'L', 'Xanh')], { v1: 3, v2: 5 });
    expect(d.hasVariants).toBe(true);
    expect(d.sizeOptions).toEqual(['M', 'L']);
    expect(d.colorOptions).toEqual(['Đỏ', 'Xanh']);
    expect(d.excludedCombos.sort()).toEqual(['l|đỏ', 'm|xanh']);
    expect(d.variants.map((v) => v.onHand)).toEqual([3, 5]);
    expect(d.basePrice).toBe((250000).toLocaleString('vi-VN'));

    const next = buildVariants(['M', 'L', 'XL'], d.colorOptions, d.variants, d.name, d.excludedCombos);
    expect(next.variants.map((v) => `${v.sizeLabel}/${v.colorLabel}`)).toEqual(['M/Đỏ', 'L/Xanh', 'XL/Đỏ', 'XL/Xanh']);
    expect(next.removed).toHaveLength(0);
  });

  it('sản phẩm một biến thể: lưu lại không đổi giá riêng và giữ id', () => {
    const d = draftFromProduct(product, [variant('v1', null, null, true)], {});
    expect(d.hasVariants).toBe(false);
    const payload = toPayload(d, 'edit');
    expect(payload.variants).toEqual([
      expect.objectContaining({ id: 'v1', price_override: null, cost_price: 120000, is_default: true, size_label: null }),
    ]);
    expect(payload.stock).toEqual([]);
    expect(payload).toMatchObject({ taxable: true, tax_industry: 'goods', vat_use_default: false, vat_rate: 10, invoice_name: null });
  });
});
