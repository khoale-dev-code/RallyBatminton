import 'server-only';

import { formatVariantLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export interface StockRow {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  kind: 'sale' | 'rental';
  variantLabel: string | null;
  onHand: number;
  reorderLevel: number;
  isListed: boolean;
  low: boolean;
}

function variantLabel(size: string | null, color: string | null): string | null {
  return formatVariantLabel(size, color);
}

export async function getBranchStock(branchId: string, opts: { q?: string; lowOnly?: boolean; kind?: 'sale' | 'rental' }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inventory_levels')
    .select(
      'variant_id, on_hand, reorder_level, is_listed, product_variants!inner(sku, size_label, color_label, deleted_at, products!product_variants_product_id_fkey!inner(id, name, kind, deleted_at))',
    )
    .eq('branch_id', branchId)
    .is('product_variants.deleted_at', null)
    .is('product_variants.products.deleted_at', null)
    .limit(500);
  if (error) throw error;
  const term = opts.q?.trim().toLowerCase();
  const rows: StockRow[] = (data ?? []).map((l) => ({
    variantId: l.variant_id,
    sku: l.product_variants.sku,
    productId: l.product_variants.products.id,
    productName: l.product_variants.products.name,
    kind: l.product_variants.products.kind,
    variantLabel: variantLabel(l.product_variants.size_label, l.product_variants.color_label),
    onHand: l.on_hand,
    reorderLevel: l.reorder_level,
    isListed: l.is_listed,
    low: l.on_hand <= l.reorder_level,
  }));
  return rows
    .filter((r) => (opts.kind ? r.kind === opts.kind : true))
    .filter((r) => (opts.lowOnly ? r.low : true))
    .filter((r) => (term ? r.productName.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term) : true))
    .sort((a, b) => Number(b.low) - Number(a.low) || a.productName.localeCompare(b.productName, 'vi'));
}

/** Biến thể chưa có dòng tồn tại chi nhánh (để nhập hàng lần đầu). */
export async function listUnstockedVariants(branchId: string) {
  const supabase = await createClient();
  const [{ data: variants }, { data: levels }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, sku, size_label, color_label, products!product_variants_product_id_fkey!inner(name, is_bundle, deleted_at)')
      .is('deleted_at', null)
      .eq('products.is_bundle', false)
      .is('products.deleted_at', null)
      .order('sku'),
    supabase.from('inventory_levels').select('variant_id').eq('branch_id', branchId),
  ]);
  const stocked = new Set((levels ?? []).map((l) => l.variant_id));
  return (variants ?? [])
    .filter((v) => !stocked.has(v.id))
    .map((v) => ({
      id: v.id,
      label: `${[v.products.name, variantLabel(v.size_label, v.color_label)].filter(Boolean).join(', ')} (${v.sku})`,
    }));
}

export async function getVariantStock(branchId: string, variantId: string) {
  const supabase = await createClient();
  const [{ data: variant }, { data: level }, { data: movements }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, sku, size_label, color_label, product_id, products!product_variants_product_id_fkey(name, kind, is_bundle)')
      .eq('id', variantId)
      .maybeSingle(),
    supabase
      .from('inventory_levels')
      .select('on_hand, reorder_level, is_listed, updated_at')
      .eq('branch_id', branchId)
      .eq('variant_id', variantId)
      .maybeSingle(),
    supabase
      .from('stock_movements')
      .select('id, quantity_delta, balance_after, reason, note, created_at, created_by')
      .eq('branch_id', branchId)
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100),
  ]);
  if (!variant) return null;
  return {
    variant,
    label: [variant.products?.name, variantLabel(variant.size_label, variant.color_label)].filter(Boolean).join(', '),
    level,
    movements: movements ?? [],
  };
}
