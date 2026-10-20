import 'server-only';

import { type Enums } from '@/lib/supabase/database.types';
import { formatVariantLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export type ProductKind = Enums<'product_kind'>;

export type ProductStatusFilter = 'all' | 'active' | 'hidden' | 'archived';

export interface AdminProductFilter {
  kind: ProductKind;
  q?: string;
  status?: ProductStatusFilter;
  categoryId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listProductsAdmin({ kind, q, status = 'all', categoryId }: AdminProductFilter) {
  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select(
      'id, name, kind, base_price, brand_name, is_active, is_bundle, deleted_at, show_on_website, show_on_pos, unit_label, product_categories(name), product_variants!product_variants_product_id_fkey(id, sku, size_label, price_override, deleted_at, inventory_levels(on_hand, reorder_level, is_listed)), product_photos(storage_path, is_cover), rental_rates(price, is_active)',
    )
    .eq('kind', kind)
    .order('name')
    .limit(200);
  if (status === 'archived') query = query.not('deleted_at', 'is', null);
  else query = query.is('deleted_at', null);
  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'hidden') query = query.eq('is_active', false);
  if (categoryId && UUID.test(categoryId)) query = query.eq('category_id', categoryId);

  // Tìm theo tên, thương hiệu, SKU hoặc mã vạch (ký tự đặc biệt của bộ lọc được loại bỏ).
  const term = q
    ?.trim()
    .replace(/[%,()*:"\\]/g, '')
    .slice(0, 60);
  if (term) {
    const { data: hits } = await supabase
      .from('product_variants')
      .select('product_id')
      .or(`sku.ilike.%${term}%,barcode.eq.${term}`)
      .limit(100);
    const ids = [...new Set((hits ?? []).map((h) => h.product_id))];
    query = query.or([`name.ilike.%${term}%`, `brand_name.ilike.%${term}%`, ...(ids.length ? [`id.in.(${ids.join(',')})`] : [])].join(','));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((p) => {
    const variants = p.product_variants.filter((v) => v.deleted_at === null);
    const rates = p.rental_rates.filter((r) => r.is_active).map((r) => r.price);
    const levels = variants.flatMap((v) => v.inventory_levels);
    const prices = variants.map((v) => v.price_override ?? p.base_price).filter((x): x is number => x !== null);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      brandName: p.brand_name,
      basePrice: p.base_price,
      minPrice: prices.length ? Math.min(...prices) : p.base_price,
      maxPrice: prices.length ? Math.max(...prices) : p.base_price,
      unitLabel: p.unit_label,
      isActive: p.is_active,
      isBundle: p.is_bundle,
      archived: p.deleted_at !== null,
      onWebsite: p.show_on_website,
      onPos: p.show_on_pos,
      category: p.product_categories?.name ?? null,
      variantCount: variants.length,
      sku: variants[0]?.sku ?? null,
      onHand: levels.reduce((sum, l) => sum + l.on_hand, 0),
      tracked: levels.length > 0,
      lowStock: levels.some((l) => l.is_listed && l.reorder_level > 0 && l.on_hand <= l.reorder_level),
      cover: p.product_photos.find((ph) => ph.is_cover)?.storage_path ?? p.product_photos[0]?.storage_path ?? null,
      fromRate: rates.length > 0 ? Math.min(...rates) : null,
    };
  });
}

export type AdminProductRow = Awaited<ReturnType<typeof listProductsAdmin>>[number];

export async function listCategoriesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_categories')
    .select('id, slug, name, sort_order, is_active')
    .order('sort_order')
    .order('name');
  return data ?? [];
}

export async function getProductForEdit(id: string) {
  const supabase = await createClient();
  // Mọi truy vấn chỉ cần id sản phẩm → chạy cùng lúc (tồn kho lấy kèm biến thể) — 1 lượt mạng thay vì 2.
  const [{ data: product }, { data: components }, { data: branches }, { data: costs }, { data: units }] = await Promise.all([
    supabase
      .from('products')
      .select(
        '*, product_variants!product_variants_product_id_fkey(id, sku, size_label, color_label, price_override, barcode, is_default, is_active, sort_order, deleted_at, inventory_levels(branch_id, variant_id, on_hand, reorder_level, is_listed)), product_photos(id, storage_path, alt_text, is_cover, sort_order), rental_rates(id, label, duration_minutes, price, is_active, usage, billing, grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('bundle_components')
      .select(
        'component_variant_id, quantity, product_variants(sku, size_label, color_label, products!product_variants_product_id_fkey(name))',
      )
      .eq('bundle_product_id', id),
    supabase.from('branches').select('id, name').is('deleted_at', null).order('name'),
    // Giá vốn không đọc trực tiếp được (quyền theo cột) — hàm này kiểm tra quyền xem danh mục.
    supabase.rpc('get_variant_costs', { p_product_id: id }),
    supabase
      .from('product_units')
      .select('id, name, conversion, price, barcode')
      .eq('product_id', id)
      .is('deleted_at', null)
      .order('sort_order'),
  ]);
  if (!product) return null;
  const levels = product.product_variants.flatMap((v) => v.inventory_levels);
  const costOf = new Map((costs ?? []).map((c) => [c.variant_id, c.cost_price ?? null]));

  return {
    product,
    variants: [...product.product_variants]
      .map(({ inventory_levels: _levels, ...v }) => ({ ...v, cost_price: costOf.get(v.id) ?? null }))
      .filter((v) => v.deleted_at === null)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order),
    photos: [...product.product_photos].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order),
    rates: [...product.rental_rates].sort((a, b) => a.duration_minutes - b.duration_minutes),
    components: components ?? [],
    units: units ?? [],
    levels,
    branches: branches ?? [],
  };
}

export type ProductForEdit = NonNullable<Awaited<ReturnType<typeof getProductForEdit>>>;

/** Nhãn đã dùng ở các sản phẩm khác — gợi ý khi gắn nhãn. */
export async function listTagSuggestions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('tags').is('deleted_at', null).limit(500);
  const count = new Map<string, number>();
  for (const row of data ?? []) for (const t of row.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .slice(0, 40)
    .map(([t]) => t);
}

/** Biến thể có thể làm thành phần combo: món thuê thường (không phải combo). */
export async function listComponentCandidates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_variants')
    .select('id, sku, size_label, color_label, products!product_variants_product_id_fkey!inner(name, kind, is_bundle, deleted_at)')
    .eq('products.kind', 'rental')
    .eq('products.is_bundle', false)
    .is('products.deleted_at', null)
    .is('deleted_at', null)
    .order('sku');
  return (data ?? []).map((v) => ({
    id: v.id,
    label: `${[v.products.name, formatVariantLabel(v.size_label, v.color_label)].filter(Boolean).join(', ')} (${v.sku})`,
  }));
}
