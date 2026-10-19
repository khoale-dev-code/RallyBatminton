import { describe, expect, it } from 'vitest';

import { addOption, buildVariants, emptyVariant, margin, parseMoney, suggestSku, toPayload, type ProductDraft } from './product-draft';
import { productPayloadSchema } from './product-payload';

const draft = (over: Partial<ProductDraft> = {}): ProductDraft => ({
  kind: 'sale',
  isBundle: false,
  name: 'Áo thi đấu Rally',
  categoryId: '',
  brandName: '',
  description: '',
  excerpt: '',
  basePrice: '250.000',
  compareAtPrice: '',
  unitLabel: 'cái',
  tags: ['mới'],
  seoTitle: '',
  seoDescription: '',
  showOnWebsite: true,
  showOnPos: true,
  isActive: true,
  hasVariants: false,
  sizeOptions: [],
  colorOptions: [],
  variants: [{ ...emptyVariant('AO-RALLY'), costPrice: '120.000' }],
  archivedVariantIds: [],
  excludedCombos: [],
  option1Name: null,
  option2Name: null,
  hasUnits: false,
  units: [],
  archivedUnitIds: [],
  invoiceName: '',
  taxable: true,
  taxIndustry: 'goods',
  vatUseDefault: true,
  vatRate: '',
  stock: {},
  reorderLevel: '2',
  rates: [],
  skuTouched: false,
  ...over,
});

describe('tiền và SKU', () => {
  it('đọc số tiền có dấu chấm', () => {
    expect(parseMoney('250.000 đ')).toBe(250000);
    expect(parseMoney('')).toBeNull();
  });
  it('gợi ý SKU không dấu, cắt theo từ', () => {
    expect(suggestSku('Nước suối Aquafina 500ml')).toBe('NUOC-SUOI-AQUAFINA-500ML');
    expect(suggestSku('Áo thi đấu', ['M', 'Đỏ'])).toBe('AO-THI-DAU-M-DO');
  });
  it('biên lợi nhuận', () => {
    expect(margin(250000, 120000)).toEqual({ profit: 130000, percent: 52 });
    expect(margin(null, 1)).toBeNull();
  });
});

describe('biến thể', () => {
  it('sinh tổ hợp size × màu, giữ dữ liệu đã nhập', () => {
    const first = buildVariants(['M', 'L'], ['Đen'], [], 'Áo');
    expect(first.variants.map((v) => `${v.sizeLabel}/${v.colorLabel}`)).toEqual(['M/Đen', 'L/Đen']);
    expect(first.variants.filter((v) => v.isDefault)).toHaveLength(1);
    const edited = first.variants.map((v) => (v.sizeLabel === 'L' ? { ...v, price: '270.000' } : v));
    const second = buildVariants(['M', 'L'], ['Đen', 'Trắng'], edited, 'Áo');
    expect(second.variants).toHaveLength(4);
    expect(second.variants.find((v) => v.sizeLabel === 'L' && v.colorLabel === 'Đen')?.price).toBe('270.000');
    const third = buildVariants(['M'], ['Đen'], second.variants, 'Áo');
    expect(third.removed).toHaveLength(3);
  });
  it('thêm tùy chọn bỏ trùng, tách dấu phẩy', () => {
    expect(addOption(['M'], 'm, L ,XL')).toEqual(['M', 'L', 'XL']);
  });
});

describe('dữ liệu gửi database', () => {
  it('sản phẩm 1 biến thể hợp lệ, có tồn đầu kỳ', () => {
    const d = draft();
    const key = d.variants[0]?.key ?? '';
    const payload = toPayload({ ...d, stock: { '8f05e075-37e0-40ed-908b-7358c9870cb9': { listed: true, qty: { [key]: 5 } } } }, 'create');
    expect(payload.base_price).toBe(250000);
    expect(payload.variants[0]?.cost_price).toBe(120000);
    expect(payload.stock).toEqual([{ branch_id: '8f05e075-37e0-40ed-908b-7358c9870cb9', variant_index: 0, quantity: 5 }]);
    expect(productPayloadSchema.safeParse(payload).success).toBe(true);
  });
  it('giá biến thể trùng giá chung thì không lưu giá riêng; báo SKU trùng', () => {
    const built = buildVariants(['M', 'L'], [], [], 'Áo');
    const variants = built.variants.map((v, i) => ({ ...v, sku: 'AO-1', price: i === 0 ? '250.000' : '270.000' }));
    const payload = toPayload(draft({ hasVariants: true, sizeOptions: ['M', 'L'], variants }), 'create');
    expect(payload.variants.map((v) => v.price_override)).toEqual([null, 270000]);
    const result = productPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join('.') === 'variants.1.sku')).toBe(true);
  });
  it('giá so sánh phải lớn hơn giá bán', () => {
    const result = productPayloadSchema.safeParse(toPayload(draft({ compareAtPrice: '200.000' }), 'create'));
    expect(result.error?.issues[0]?.path.join('.')).toBe('compare_at_price');
  });
});

describe('buildVariants giữ biến thể đơn khi bật size/màu', () => {
  it('biến thể đã lưu nhận tổ hợp đầu tiên, không bị ngừng', () => {
    const saved = { ...emptyVariant('NUOC-STING'), id: 'v-saved', onHand: 24 };
    const { variants, removed } = buildVariants(['Lon', 'Chai'], [], [saved], 'Nước Sting');
    expect(removed).toHaveLength(0);
    expect(variants[0]).toMatchObject({ id: 'v-saved', key: saved.key, sizeLabel: 'Lon', sku: 'NUOC-STING', isDefault: true });
    expect(variants[1]).toMatchObject({ id: null, sizeLabel: 'Chai', sku: 'NUOC-STING-CHAI', isDefault: false });
  });
});

describe('đơn vị tính và tên thuộc tính', () => {
  it('gửi đơn vị quy đổi và tên thuộc tính khi bật', () => {
    const d = draft({
      unitLabel: 'lon',
      hasUnits: true,
      units: [{ key: 'u1', id: null, name: ' Thùng ', conversion: '24', price: '450.000', barcode: '' }],
      hasVariants: true,
      option1Name: 'Dung tích',
      option2Name: null,
    });
    const p = toPayload(d, 'create');
    expect(p.units).toEqual([{ id: null, name: 'Thùng', conversion: 24, price: 450000, barcode: null }]);
    expect(p.option1_name).toBe('Dung tích');
    expect(p.option2_name).toBeNull();
  });
  it('tắt nhiều đơn vị hoặc biến thể thì không gửi', () => {
    const p = toPayload(draft({ hasUnits: false, units: [], option1Name: 'Màu sắc', hasVariants: false }), 'edit');
    expect(p.units).toEqual([]);
    expect(p.option1_name).toBeNull();
  });
});
