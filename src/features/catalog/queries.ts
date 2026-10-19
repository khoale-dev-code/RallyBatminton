import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { type Enums } from '@/lib/supabase/database.types';
import { createPublicClient } from '@/lib/supabase/public';

export const CATALOG_PAGE_SIZE = 24;

export interface CatalogItem {
  id: string;
  name: string;
  kind: Enums<'product_kind'>;
  isBundle: boolean;
  brandName: string | null;
  categoryName: string | null;
  minPrice: number;
  maxPrice: number;
  compareAtPrice: number | null;
  coverPath: string | null;
  available: number;
}

export interface CatalogFilters {
  kind: Enums<'product_kind'>;
  category?: string;
  branchId?: string;
  q?: string;
  page: number;
}

const fetchCatalog = unstable_cache(
  async (filters: CatalogFilters): Promise<{ items: CatalogItem[]; total: number }> => {
    const { data, error } = await createPublicClient().rpc('list_catalog', {
      p_kind: filters.kind,
      p_category_slug: filters.category,
      p_branch_id: filters.branchId,
      p_search: filters.q,
      p_limit: CATALOG_PAGE_SIZE,
      p_offset: (filters.page - 1) * CATALOG_PAGE_SIZE,
    });
    if (error) throw new Error(error.message);
    return {
      total: Number(data[0]?.total_count ?? 0),
      items: data.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        isBundle: r.is_bundle,
        brandName: r.brand_name,
        categoryName: r.category_name,
        minPrice: r.min_price,
        maxPrice: r.max_price,
        compareAtPrice: r.compare_at_price,
        coverPath: r.cover_path,
        available: Number(r.available_quantity),
      })),
    };
  },
  ['catalog-list'],
  { tags: [PUBLIC_TAGS.catalog], revalidate: PUBLIC_REVALIDATE.catalog },
);

/** Danh mục công khai (cache ngắn; xóa khi admin sửa sản phẩm / bán / nhập kho). */
export async function listCatalog(filters: CatalogFilters): Promise<{ items: CatalogItem[]; total: number } | null> {
  if (!isSupabaseConfigured()) return null;
  return fetchCatalog(filters).catch(() => null);
}

const fetchCategories = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient().from('product_categories').select('slug, name').order('sort_order');
    if (error) throw new Error(error.message);
    return data;
  },
  ['catalog-categories'],
  { tags: [PUBLIC_TAGS.catalog], revalidate: PUBLIC_REVALIDATE.catalog },
);

export const listCategories = cache(async () => {
  if (!isSupabaseConfigured()) return [];
  return fetchCategories().catch(() => []);
});

const fetchBranchOptions = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient().from('branches').select('id, name, slug').order('name');
    if (error) throw new Error(error.message);
    return data;
  },
  ['catalog-branch-options'],
  { tags: [PUBLIC_TAGS.branches], revalidate: PUBLIC_REVALIDATE.branches },
);

export const listBranchOptions = cache(async () => {
  if (!isSupabaseConfigured()) return [];
  return fetchBranchOptions().catch(() => []);
});

async function queryProductDetail(id: string, kind: Enums<'product_kind'>) {
  const { data, error } = await createPublicClient()
    .from('products')
    .select(
      `id, kind, name, description, excerpt, unit_label, seo_title, seo_description, brand_name, base_price, compare_at_price, is_bundle,
       option1_name, option2_name, product_units(id, name, conversion, price, deleted_at, sort_order),
       product_categories(name, slug),
       product_photos(storage_path, alt_text, sort_order, is_cover),
       product_variants!product_variants_product_id_fkey(id, sku, size_label, color_label, price_override, sort_order,
         inventory_levels(on_hand, is_listed, branches(id, name, slug))),
       rental_rates(id, label, duration_minutes, price, is_active, usage, billing),
       bundle_components(quantity, product_variants(id, size_label, color_label, products!product_variants_product_id_fkey(name)))`,
    )
    .eq('id', id)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const fetchProductDetail = unstable_cache(queryProductDetail, ['catalog-product'], {
  tags: [PUBLIC_TAGS.catalog],
  revalidate: PUBLIC_REVALIDATE.catalog,
});

export const getProductDetail = cache(async (id: string, kind: Enums<'product_kind'>) => {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return fetchProductDetail(id, kind).catch(() => null);
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

/** Tiêu đề/mô tả cho Google: ưu tiên phần SEO nhập riêng, rồi trích dẫn, rồi đầu mô tả. */
export function productMetadata(product: ProductDetail | null): { title: string; description?: string } {
  if (!product) return { title: 'Sản phẩm' };
  const text = (product.seo_description ?? product.excerpt ?? product.description ?? '').replace(/\s+/g, ' ').trim();
  return {
    title: product.seo_title ?? product.name,
    ...(text ? { description: text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text } : {}),
  };
}
