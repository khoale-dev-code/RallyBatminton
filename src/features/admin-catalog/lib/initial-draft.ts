import { isTaxIndustry } from '@/lib/tax';

import {
  comboKey,
  emptyRate,
  emptyVariant,
  formatMoneyInput,
  newKey,
  type ProductDraft,
  type ProductKind,
  type VariantDraft,
} from './product-draft';

const money = (n: number | null | undefined): string => (n === null || n === undefined ? '' : formatMoneyInput(String(n)));

/** Bản nháp trống cho màn tạo sản phẩm. Mặc định bày bán ở mọi chi nhánh người dùng được sửa. */
export function newProductDraft(kind: ProductKind, isBundle: boolean, branchIds: string[]): ProductDraft {
  const variant = emptyVariant();
  return {
    kind,
    isBundle: kind === 'rental' && isBundle,
    name: '',
    categoryId: '',
    brandName: '',
    description: '',
    excerpt: '',
    basePrice: '',
    compareAtPrice: '',
    unitLabel: '',
    tags: [],
    seoTitle: '',
    seoDescription: '',
    showOnWebsite: true,
    showOnPos: true,
    isActive: true,
    hasVariants: false,
    sizeOptions: [],
    colorOptions: [],
    variants: [variant],
    archivedVariantIds: [],
    excludedCombos: [],
    option1Name: null,
    option2Name: null,
    hasUnits: false,
    units: [],
    archivedUnitIds: [],
    invoiceName: '',
    taxable: true,
    taxIndustry: kind === 'rental' ? 'rental' : 'goods',
    vatUseDefault: true,
    vatRate: '',
    stock: Object.fromEntries(branchIds.map((id) => [id, { listed: true, qty: {} }])),
    reorderLevel: '',
    rates: kind === 'rental' ? [emptyRate()] : [],
    skuTouched: false,
  };
}

export interface ProductRecord {
  kind: ProductKind;
  is_bundle: boolean;
  name: string;
  category_id: string | null;
  brand_name: string | null;
  description: string | null;
  excerpt: string | null;
  base_price: number | null;
  compare_at_price: number | null;
  unit_label: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  show_on_website: boolean;
  show_on_pos: boolean;
  is_active: boolean;
  invoice_name: string | null;
  taxable: boolean;
  tax_industry: string | null;
  vat_use_default: boolean;
  vat_rate: number | null;
  option1_name: string | null;
  option2_name: string | null;
}

export interface UnitRecord {
  id: string;
  name: string;
  conversion: number;
  price: number | null;
  barcode: string | null;
}

export interface VariantRecord {
  id: string;
  sku: string;
  size_label: string | null;
  color_label: string | null;
  price_override: number | null;
  cost_price: number | null;
  barcode: string | null;
  is_default: boolean;
  is_active: boolean;
}

const uniq = (values: Array<string | null>): string[] => {
  const out: string[] = [];
  for (const v of values) if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  return out;
};

/** Sản phẩm đã lưu → bản nháp cho màn sửa. onHand: tổng tồn theo biến thể (các chi nhánh được xem). */
export function draftFromProduct(
  p: ProductRecord,
  variants: VariantRecord[],
  onHand: Record<string, number>,
  units: UnitRecord[] = [],
): ProductDraft {
  const list: VariantDraft[] = variants.map((v) => ({
    key: newKey('v'),
    id: v.id,
    sizeLabel: v.size_label ?? '',
    colorLabel: v.color_label ?? '',
    sku: v.sku,
    price: v.price_override !== null ? money(v.price_override) : '',
    costPrice: money(v.cost_price),
    barcode: v.barcode ?? '',
    isDefault: v.is_default,
    isActive: v.is_active,
    onHand: onHand[v.id] ?? 0,
  }));
  if (list.length > 0 && !list.some((v) => v.isDefault)) list[0] = { ...list[0]!, isDefault: true };
  const hasVariants = !p.is_bundle && (list.length > 1 || list.some((v) => v.sizeLabel || v.colorLabel));
  const sizes = hasVariants ? uniq(list.map((v) => v.sizeLabel)) : [];
  const colors = hasVariants ? uniq(list.map((v) => v.colorLabel)) : [];
  // Tổ hợp chưa từng có thì coi như đã bỏ, để thêm size/màu mới không sinh ra tổ hợp ngoài ý muốn.
  const have = new Set(list.map((v) => comboKey(v.sizeLabel, v.colorLabel)));
  const excludedCombos = (sizes.length ? sizes : ['']).flatMap((sz) =>
    (colors.length ? colors : ['']).map((c) => comboKey(sz, c)).filter((k) => !have.has(k)),
  );
  return {
    kind: p.kind,
    isBundle: p.is_bundle,
    name: p.name,
    categoryId: p.category_id ?? '',
    brandName: p.brand_name ?? '',
    description: p.description ?? '',
    excerpt: p.excerpt ?? '',
    basePrice: money(p.base_price),
    compareAtPrice: money(p.compare_at_price),
    unitLabel: p.unit_label ?? '',
    tags: p.tags,
    seoTitle: p.seo_title ?? '',
    seoDescription: p.seo_description ?? '',
    showOnWebsite: p.show_on_website,
    showOnPos: p.show_on_pos,
    isActive: p.is_active,
    hasVariants,
    sizeOptions: sizes,
    colorOptions: colors,
    variants: list.length > 0 ? list : [emptyVariant()],
    archivedVariantIds: [],
    excludedCombos,
    option1Name: hasVariants ? (p.option1_name ?? (sizes.length > 0 ? 'Kích thước' : null)) : null,
    option2Name: hasVariants ? (p.option2_name ?? (colors.length > 0 ? 'Màu sắc' : null)) : null,
    hasUnits: units.length > 0,
    units: units.map((u) => ({
      key: newKey('u'),
      id: u.id,
      name: u.name,
      conversion: String(u.conversion),
      price: u.price === null ? '' : money(u.price),
      barcode: u.barcode ?? '',
    })),
    archivedUnitIds: [],
    invoiceName: p.invoice_name ?? '',
    taxable: p.taxable,
    taxIndustry: isTaxIndustry(p.tax_industry) ? p.tax_industry : '',
    vatUseDefault: p.vat_use_default,
    vatRate: p.vat_rate === null ? '' : String(Number(p.vat_rate)).replace('.', ','),
    stock: {},
    reorderLevel: '',
    rates: [],
    skuTouched: true,
  };
}
