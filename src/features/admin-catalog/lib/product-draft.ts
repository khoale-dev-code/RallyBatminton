import { formatMinutes } from '@/lib/format';
import { type RentalRateKind } from '@/lib/labels';
import { type TaxIndustry } from '@/lib/tax';

import { type ProductPayload } from './product-payload';

/** Bản nháp trên màn hình thêm/sửa sản phẩm — mọi ô nhập giữ dạng chuỗi như người dùng gõ. */

export type ProductKind = 'sale' | 'rental';

export interface VariantDraft {
  /** Khóa ổn định phía trình duyệt (React key, bảng tồn đầu kỳ). */
  key: string;
  /** id biến thể đã có trong database (màn sửa); null = biến thể mới. */
  id: string | null;
  sizeLabel: string;
  colorLabel: string;
  sku: string;
  /** Giá riêng; để trống = dùng giá bán chung. */
  price: string;
  costPrice: string;
  barcode: string;
  isDefault: boolean;
  isActive: boolean;
  /** Tồn hiện tại (chỉ đọc, màn sửa). */
  onHand: number | null;
}

export interface RateDraft {
  key: string;
  /** 'on_site:duration' | 'on_site:session' | 'take_out:duration' (RENTAL_RATE_KINDS). */
  kind: RentalRateKind;
  label: string;
  minutes: string;
  price: string;
}

/** Đơn vị quy đổi (lốc, thùng…): conversion = số đơn vị cơ bản. */
export interface UnitDraft {
  key: string;
  id: string | null;
  name: string;
  conversion: string;
  price: string;
  barcode: string;
}

export interface BranchStockDraft {
  listed: boolean;
  /** variantKey → số lượng tồn đầu kỳ */
  qty: Record<string, number>;
}

export interface ProductDraft {
  kind: ProductKind;
  isBundle: boolean;
  name: string;
  categoryId: string;
  brandName: string;
  description: string;
  excerpt: string;
  basePrice: string;
  compareAtPrice: string;
  unitLabel: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  showOnWebsite: boolean;
  showOnPos: boolean;
  isActive: boolean;
  hasVariants: boolean;
  sizeOptions: string[];
  colorOptions: string[];
  variants: VariantDraft[];
  archivedVariantIds: string[];
  /** Tên 2 thuộc tính biến thể (null = chưa dùng). Giá trị lưu ở sizeLabel (1) và colorLabel (2). */
  option1Name: string | null;
  option2Name: string | null;
  hasUnits: boolean;
  units: UnitDraft[];
  archivedUnitIds: string[];
  /** Tổ hợp size|màu người dùng đã bỏ — không tự sinh lại khi thêm giá trị mới. */
  excludedCombos: string[];
  /** Thuế: tên trên hóa đơn, có/không chịu thuế, nhóm ngành nghề, mức VAT. */
  invoiceName: string;
  taxable: boolean;
  taxIndustry: TaxIndustry | '';
  vatUseDefault: boolean;
  vatRate: string;
  stock: Record<string, BranchStockDraft>;
  reorderLevel: string;
  rates: RateDraft[];
  /** SKU người dùng tự sửa thì không tự sinh lại theo tên. */
  skuTouched: boolean;
}

let counter = 0;
export function newKey(prefix = 'k'): string {
  counter += 1;
  return `${prefix}${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/** "250.000 đ" / "250 000" / "250000" → 250000; ô trống → null. */
export function parseMoney(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** 250000 → "250.000" (dùng khi rời ô nhập). */
export function formatMoneyInput(value: string): string {
  const n = parseMoney(value);
  return n === null ? '' : n.toLocaleString('vi-VN');
}

export function foldAscii(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** "Nước suối Aquafina 500ml" → "NUOC-SUOI-AQUAFINA-500ML" (cắt theo từ, tối đa 24 ký tự). */
export function suggestSku(name: string, suffix: string[] = []): string {
  const words = foldAscii(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base = '';
  for (const w of words) {
    const next = base ? `${base}-${w}` : w;
    if (next.length > 24) break;
    base = next;
  }
  if (!base && words[0]) base = words[0].slice(0, 24);
  const tail = suffix
    .map((s) =>
      foldAscii(s)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ''),
    )
    .filter(Boolean)
    .join('-');
  const sku = [base || 'SP', tail].filter(Boolean).join('-');
  return sku.slice(0, 40);
}

export function variantTitle(v: Pick<VariantDraft, 'sizeLabel' | 'colorLabel'>): string {
  return [v.sizeLabel, v.colorLabel].filter(Boolean).join(' / ') || 'Mặc định';
}

export function emptyUnit(): UnitDraft {
  return { key: newKey('u'), id: null, name: '', conversion: '', price: '', barcode: '' };
}

/** Thuộc tính biến thể gợi ý (người dùng có thể tự gõ tên khác). */
export const ATTRIBUTE_PRESETS = ['Kích thước', 'Màu sắc', 'Dung tích', 'Chất liệu', 'Hương vị', 'Kiểu dáng', 'Trọng lượng'];

export function comboKey(size: string, color: string): string {
  return `${size.trim().toLowerCase()}|${color.trim().toLowerCase()}`;
}

export function emptyVariant(sku = ''): VariantDraft {
  return {
    key: newKey('v'),
    id: null,
    sizeLabel: '',
    colorLabel: '',
    sku,
    price: '',
    costPrice: '',
    barcode: '',
    isDefault: true,
    isActive: true,
    onHand: null,
  };
}

export function emptyRate(): RateDraft {
  return { key: newKey('r'), kind: 'on_site:duration', label: '', minutes: '120', price: '' };
}

/**
 * Sinh danh sách biến thể từ các giá trị Size × Màu (giữ nguyên biến thể đã nhập nếu trùng tổ hợp).
 * Trả về cả các biến thể cũ (đã lưu) bị loại để màn sửa ngừng chúng.
 */
export function buildVariants(
  sizes: string[],
  colors: string[],
  existing: VariantDraft[],
  productName: string,
  excluded: string[] = [],
): { variants: VariantDraft[]; removed: VariantDraft[] } {
  const sizeList = sizes.length > 0 ? sizes : [''];
  const colorList = colors.length > 0 ? colors : [''];
  const byCombo = new Map(existing.map((v) => [comboKey(v.sizeLabel, v.colorLabel), v]));
  const used = new Set<string>();
  const skip = new Set(excluded);
  const variants: VariantDraft[] = [];
  // Biến thể "chưa có size/màu" (sản phẩm một biến thể) nhận tổ hợp đầu tiên thay vì bị ngừng — giữ tồn kho, lịch sử.
  let blank = byCombo.get('|');
  const adopted = new Set<string>();
  for (const size of sizeList) {
    for (const color of colorList) {
      const key = comboKey(size, color);
      if (used.has(key) || skip.has(key)) continue;
      used.add(key);
      const prev = byCombo.get(key);
      if (prev) {
        variants.push({ ...prev, sizeLabel: size || prev.sizeLabel, colorLabel: color || prev.colorLabel });
      } else if (blank && key !== '|' && !byCombo.has(key)) {
        variants.push({ ...blank, sizeLabel: size, colorLabel: color, sku: blank.id ? blank.sku : suggestSku(productName, [size, color]) });
        adopted.add(blank.key);
        blank = undefined;
      } else {
        variants.push({ ...emptyVariant(suggestSku(productName, [size, color])), sizeLabel: size, colorLabel: color, isDefault: false });
      }
    }
  }
  const removed = existing.filter((v) => !used.has(comboKey(v.sizeLabel, v.colorLabel)) && !adopted.has(v.key));
  if (!variants.some((v) => v.isDefault) && variants[0]) variants[0] = { ...variants[0], isDefault: true };
  let seenDefault = false;
  const normalized = variants.map((v) => {
    if (v.isDefault && !seenDefault) {
      seenDefault = true;
      return v;
    }
    return v.isDefault ? { ...v, isDefault: false } : v;
  });
  return { variants: normalized, removed };
}

/** Thêm giá trị vào danh sách tùy chọn (bỏ trống, bỏ trùng không phân biệt hoa thường). */
export function addOption(list: string[], raw: string, max = 20): string[] {
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const out = [...list];
  for (const v of values) {
    if (out.length >= max) break;
    if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v.slice(0, 30));
  }
  return out;
}

/** "8" / "8,5" / "8.5%" → 8.5; ô trống hoặc sai → null. */
export function parsePercent(value: string): number | null {
  const t = value.replace('%', '').replace(',', '.').trim();
  if (t === '' || !/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

export function margin(price: number | null, cost: number | null): { profit: number; percent: number } | null {
  if (price === null || cost === null || price <= 0) return null;
  const profit = price - cost;
  return { profit, percent: Math.round((profit / price) * 1000) / 10 };
}

const blankToNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/** Bản nháp → dữ liệu gửi database. Giá biến thể bằng giá chung thì không lưu giá riêng. */
export function toPayload(d: ProductDraft, mode: 'create' | 'edit'): ProductPayload {
  const base = d.kind === 'sale' ? parseMoney(d.basePrice) : null;
  const variants = d.isBundle ? d.variants.slice(0, 1) : d.variants;
  const indexByKey = new Map(variants.map((v, i) => [v.key, i]));
  const stock: ProductPayload['stock'] = [];
  if (mode === 'create' && !d.isBundle) {
    for (const [branchId, s] of Object.entries(d.stock)) {
      if (!s.listed) continue;
      for (const v of variants) {
        const idx = indexByKey.get(v.key);
        if (idx === undefined) continue;
        stock.push({ branch_id: branchId, variant_index: idx, quantity: Math.max(0, Math.floor(s.qty[v.key] ?? 0)) });
      }
    }
  }
  return {
    kind: d.kind,
    is_bundle: d.kind === 'rental' && d.isBundle,
    name: d.name.trim(),
    category_id: blankToNull(d.categoryId),
    brand_name: blankToNull(d.brandName),
    description: blankToNull(d.description),
    excerpt: blankToNull(d.excerpt),
    base_price: base,
    compare_at_price: d.kind === 'sale' ? parseMoney(d.compareAtPrice) : null,
    unit_label: blankToNull(d.unitLabel),
    tags: d.tags,
    seo_title: blankToNull(d.seoTitle),
    seo_description: blankToNull(d.seoDescription),
    show_on_website: d.showOnWebsite,
    show_on_pos: d.showOnPos,
    is_active: d.isActive,
    variants: variants.map((v) => {
      const price = d.kind === 'sale' ? parseMoney(v.price) : null;
      return {
        id: v.id,
        sku: v.sku.trim().toUpperCase(),
        size_label: d.hasVariants ? blankToNull(v.sizeLabel) : v.id ? blankToNull(v.sizeLabel) : null,
        color_label: d.hasVariants ? blankToNull(v.colorLabel) : v.id ? blankToNull(v.colorLabel) : null,
        price_override: price !== null && price !== base ? price : null,
        cost_price: parseMoney(v.costPrice),
        barcode: blankToNull(v.barcode),
        is_default: v.isDefault,
        is_active: v.isActive,
      };
    }),
    archived_variant_ids: mode === 'edit' ? d.archivedVariantIds : [],
    option1_name: d.hasVariants && d.option1Name ? d.option1Name.trim() || null : null,
    option2_name: d.hasVariants && d.option2Name ? d.option2Name.trim() || null : null,
    units:
      d.kind === 'sale' && d.hasUnits
        ? d.units.map((u) => ({
            id: u.id,
            name: u.name.trim(),
            conversion: Number(u.conversion.replace(/[^\d]/g, '')) || 0,
            price: parseMoney(u.price),
            barcode: blankToNull(u.barcode),
          }))
        : [],
    archived_unit_ids: mode === 'edit' ? d.archivedUnitIds : [],
    invoice_name: blankToNull(d.invoiceName),
    taxable: d.taxable,
    tax_industry: d.taxIndustry === '' ? null : d.taxIndustry,
    vat_use_default: d.vatUseDefault,
    vat_rate: d.vatUseDefault ? null : parsePercent(d.vatRate),
    stock,
    reorder_level: parseMoney(d.reorderLevel) ?? 0,
    rental_rates:
      mode === 'create' && d.kind === 'rental'
        ? d.rates.map((r) => {
            const minutes = Number(r.minutes) || 0;
            const [usage, billing] =
              r.kind === 'on_site:session'
                ? (['on_site', 'session'] as const)
                : r.kind === 'take_out:duration'
                  ? (['take_out', 'duration'] as const)
                  : (['on_site', 'duration'] as const);
            // Bỏ trống tên gói → "Hết trận" hoặc thời lượng ("2 giờ").
            const fallback = billing === 'session' ? 'Hết trận' : formatMinutes(minutes);
            return { label: r.label.trim() || fallback, duration_minutes: minutes, price: parseMoney(r.price) ?? 0, usage, billing };
          })
        : [],
  };
}

/** Lỗi thuộc khung nào → mở khung đó khi lưu thất bại. */
export type SectionId = 'general' | 'media' | 'pricing' | 'tax' | 'inventory' | 'units' | 'variants' | 'rates' | 'seo' | 'sidebar';

export function sectionOfError(key: string, hasVariants: boolean): SectionId {
  if (key.startsWith('variants')) return hasVariants ? 'variants' : key.endsWith('cost_price') ? 'pricing' : 'inventory';
  if (key.startsWith('rental_rates')) return 'rates';
  if (key.startsWith('units') || key === 'unit_label') return 'units';
  if (key.startsWith('option')) return 'variants';
  if (key.startsWith('stock') || key === 'reorder_level') return 'inventory';
  if (key.startsWith('seo')) return 'seo';
  if (['invoice_name', 'taxable', 'tax_industry', 'vat_use_default', 'vat_rate'].includes(key)) return 'tax';
  if (['base_price', 'compare_at_price'].includes(key)) return 'pricing';
  if (['tags', 'category_id', 'show_on_website', 'show_on_pos', 'is_active'].includes(key)) return 'sidebar';
  return 'general';
}
