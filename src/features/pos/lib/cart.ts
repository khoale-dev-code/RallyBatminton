/** Giỏ hàng quầy: hàm thuần, không phụ thuộc React (dễ kiểm thử). Giá cuối cùng luôn do database tính lại. */

import { taxOfAmount, type EffectiveTax } from '@/lib/tax';

export interface PosItem {
  /** Khóa duy nhất trong quầy: variantId (đơn vị cơ bản) hoặc variantId:unitId (lốc, thùng…). */
  key: string;
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string | null;
  price: number;
  /** Số lượng bán được theo đơn vị của món này (= tồn cơ bản / quy đổi). */
  onHand: number;
  categoryId: string | null;
  cover: string | null;
  /** SKU và mã vạch để tìm/quét tại quầy. */
  codes?: string[];
  /** Mức cảnh báo sắp hết tại chi nhánh (0 = không cảnh báo). */
  reorderLevel?: number;
  /** Đơn vị cơ bản của sản phẩm (lon, chai…). */
  unitLabel?: string | null;
  /** Đơn vị quy đổi (null = bán theo đơn vị cơ bản). */
  unitId?: string | null;
  unitName?: string | null;
  /** Số đơn vị cơ bản trong 1 đơn vị bán (1 với đơn vị cơ bản). */
  conversion?: number;
  /** Tồn theo đơn vị cơ bản (dùng chung cho mọi đơn vị của cùng biến thể). */
  baseOnHand?: number;
  /** Thuế áp dụng (theo cách tính của thương hiệu); null/không có = không chịu thuế. */
  tax?: EffectiveTax | null;
}

export interface CartLine {
  key: string;
  quantity: number;
}

export type CartAction =
  | { type: 'add'; item: PosItem; max: number }
  | { type: 'set'; key: string; quantity: number; max: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' };

export const MAX_LINES = 30;

const conv = (i: Pick<PosItem, 'conversion'>) => Math.max(1, i.conversion ?? 1);
const baseStock = (i: Pick<PosItem, 'baseOnHand' | 'onHand' | 'conversion'>) => i.baseOnHand ?? i.onHand * conv(i);

/**
 * Số lượng tối đa của một món trong đơn: tồn cơ bản của biến thể trừ phần các dòng khác (cùng biến thể,
 * đơn vị khác) đã giữ, rồi chia theo quy đổi. Ví dụ còn 30 lon, đã chọn 1 thùng 24 → lon tối đa 6.
 */
export function maxQuantity(item: PosItem, lines: CartLine[], items: ReadonlyMap<string, PosItem>): number {
  let used = 0;
  for (const l of lines) {
    if (l.key === item.key) continue;
    const other = items.get(l.key);
    if (other && other.variantId === item.variantId) used += l.quantity * conv(other);
  }
  return Math.max(0, Math.floor((baseStock(item) - used) / conv(item)));
}

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = lines.find((l) => l.key === action.item.key);
      if (existing) {
        if (existing.quantity >= action.max) return lines;
        return lines.map((l) => (l.key === action.item.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (action.max < 1 || lines.length >= MAX_LINES) return lines;
      return [...lines, { key: action.item.key, quantity: 1 }];
    }
    case 'set': {
      const quantity = Math.min(Math.max(0, Math.floor(action.quantity)), action.max);
      if (quantity === 0) return lines.filter((l) => l.key !== action.key);
      return lines.map((l) => (l.key === action.key ? { ...l, quantity } : l));
    }
    case 'remove':
      return lines.filter((l) => l.key !== action.key);
    case 'clear':
      return [];
  }
}

export interface CartSummary {
  rows: Array<CartLine & { item: PosItem; lineTotal: number }>;
  itemCount: number;
  subtotal: number;
}

export function summarizeCart(lines: CartLine[], items: ReadonlyMap<string, PosItem>): CartSummary {
  const rows = lines.flatMap((l) => {
    const item = items.get(l.key);
    return item ? [{ ...l, item, lineTotal: item.price * l.quantity }] : [];
  });
  return {
    rows,
    itemCount: rows.reduce((n, r) => n + r.quantity, 0),
    subtotal: rows.reduce((n, r) => n + r.lineTotal, 0),
  };
}

/** Lọc theo nhóm và từ khóa (bỏ dấu tiếng Việt để gõ "nuoc" vẫn ra "Nước"). */
export function foldVietnamese(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function filterItems(items: PosItem[], categoryId: string | null, query: string): PosItem[] {
  const raw = query.trim();
  // Quét mã vạch / gõ đúng SKU: trả đúng món đó, bỏ qua bộ lọc nhóm.
  const exact = raw.length >= 3 ? items.filter((i) => i.codes?.some((c) => c.toUpperCase() === raw.toUpperCase())) : [];
  if (exact.length > 0) return exact;
  const q = foldVietnamese(raw);
  return items.filter(
    (i) =>
      (categoryId === null || i.categoryId === categoryId) &&
      (q === '' || foldVietnamese(`${i.name} ${i.variantLabel ?? ''} ${i.unitName ?? ''} ${(i.codes ?? []).join(' ')}`).includes(q)),
  );
}

/** Tiền thối cho khách khi trả tiền mặt. */
export function changeDue(total: number, tendered: number): number | null {
  if (!Number.isFinite(tendered) || tendered < total) return null;
  return tendered - total;
}

export type StockLevel = 'out' | 'low' | 'ok';

export function stockLevel(item: Pick<PosItem, 'onHand' | 'reorderLevel' | 'baseOnHand'>): StockLevel {
  if (item.onHand <= 0) return 'out';
  const base = item.baseOnHand ?? item.onHand;
  if ((item.reorderLevel ?? 0) > 0 && base <= (item.reorderLevel ?? 0)) return 'low';
  return 'ok';
}

/** "Thùng (24 lon)" cho đơn vị quy đổi; null với đơn vị cơ bản. */
export function unitCaption(item: Pick<PosItem, 'unitId' | 'unitName' | 'conversion' | 'unitLabel'>): string | null {
  if (!item.unitId || !item.unitName) return null;
  return `${item.unitName} (${item.conversion ?? 1} ${item.unitLabel ?? 'đơn vị'})`;
}

/**
 * Thuế của giỏ (ước tính hiển thị; database tính lại từng dòng khi ghi đơn).
 * Giảm giá trên đơn được chia đều theo tỷ lệ cho các dòng.
 */
export function cartTax(
  rows: Array<{ lineTotal: number; item: Pick<PosItem, 'tax'> }>,
  discount: number,
): { vat: number; pit: number; method: 'deduction' | 'direct' | null } {
  const subtotal = rows.reduce((n, r) => n + r.lineTotal, 0);
  if (subtotal <= 0) return { vat: 0, pit: 0, method: null };
  const factor = Math.max(0, subtotal - discount) / subtotal;
  let vat = 0;
  let pit = 0;
  let method: 'deduction' | 'direct' | null = null;
  for (const r of rows) {
    const t = taxOfAmount(r.lineTotal * factor, r.item.tax ?? null);
    vat += t.vat;
    pit += t.pit;
    if (r.item.tax) method = r.item.tax.method;
  }
  return { vat, pit, method };
}

/** Gợi ý tiền khách đưa: đủ tiền, rồi các mệnh giá tròn gần nhất (tối đa 4 nút). */
export function cashSuggestions(total: number): number[] {
  if (total <= 0) return [];
  const out = new Set<number>([total]);
  for (const step of [10_000, 50_000, 100_000, 200_000, 500_000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}
