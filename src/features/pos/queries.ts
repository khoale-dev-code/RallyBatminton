import 'server-only';

import { formatVariantLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { effectiveTax, isTaxIndustry, type BrandTax } from '@/lib/tax';

import { type PosItem } from './lib/cart';

/** Hàng bán đang kinh doanh, bật kênh Quầy, có dòng tồn tại chi nhánh (kể cả tồn 0 để nhân viên thấy hết hàng). */
export async function getPosCatalog(
  branchId: string,
  brandTax: BrandTax,
): Promise<{ items: PosItem[]; categories: Array<{ id: string; name: string }> }> {
  const supabase = await createClient();
  const [{ data: levels, error }, { data: categories }] = await Promise.all([
    supabase
      .from('inventory_levels')
      .select(
        'variant_id, on_hand, reorder_level, product_variants!inner(id, sku, barcode, size_label, color_label, price_override, is_active, deleted_at, products!product_variants_product_id_fkey!inner(id, name, kind, base_price, category_id, is_active, show_on_pos, deleted_at, unit_label, taxable, tax_industry, vat_use_default, vat_rate, product_photos(storage_path, is_cover), product_units(id, name, conversion, price, barcode, deleted_at, sort_order)))',
      )
      .eq('branch_id', branchId)
      .eq('product_variants.is_active', true)
      .is('product_variants.deleted_at', null)
      .eq('product_variants.products.kind', 'sale')
      .eq('product_variants.products.is_active', true)
      .eq('product_variants.products.show_on_pos', true)
      .is('product_variants.products.deleted_at', null),
    supabase.from('product_categories').select('id, name').eq('is_active', true).order('sort_order'),
  ]);
  if (error) throw error;
  const items: PosItem[] = (levels ?? []).flatMap((l) => {
    const v = l.product_variants;
    const p = v.products;
    const price = v.price_override ?? p.base_price;
    if (price === null) return [];
    const label = formatVariantLabel(v.size_label, v.color_label) ?? '';
    const base: PosItem = {
      key: v.id,
      variantId: v.id,
      productId: p.id,
      name: p.name,
      variantLabel: label || null,
      price,
      onHand: l.on_hand,
      categoryId: p.category_id,
      cover: p.product_photos.find((ph) => ph.is_cover)?.storage_path ?? p.product_photos[0]?.storage_path ?? null,
      codes: [v.sku, v.barcode].filter((c): c is string => Boolean(c)),
      reorderLevel: l.reorder_level,
      unitLabel: p.unit_label,
      unitId: null,
      unitName: p.unit_label,
      conversion: 1,
      baseOnHand: l.on_hand,
      tax: effectiveTax(
        {
          taxable: p.taxable,
          industry: isTaxIndustry(p.tax_industry) ? p.tax_industry : null,
          vatUseDefault: p.vat_use_default,
          vatRate: p.vat_rate === null ? null : Number(p.vat_rate),
        },
        brandTax,
      ),
    };
    // Đơn vị quy đổi (lốc, thùng…): món riêng trên quầy, dùng chung tồn kho cơ bản của biến thể.
    const units: PosItem[] = p.product_units
      .filter((u) => u.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((u) => ({
        ...base,
        key: `${v.id}:${u.id}`,
        price: u.price ?? price * u.conversion,
        onHand: Math.floor(l.on_hand / u.conversion),
        codes: u.barcode ? [u.barcode] : [],
        unitId: u.id,
        unitName: u.name,
        conversion: u.conversion,
      }));
    return [base, ...units];
  });
  items.sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'vi') ||
      (a.variantLabel ?? '').localeCompare(b.variantLabel ?? '', 'vi') ||
      (a.conversion ?? 1) - (b.conversion ?? 1),
  );
  const used = new Set(items.map((i) => i.categoryId));
  return { items, categories: (categories ?? []).filter((c) => used.has(c.id)) };
}
