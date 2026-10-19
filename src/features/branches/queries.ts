import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { createPublicClient } from '@/lib/supabase/public';
import { type Tables } from '@/lib/supabase/database.types';

import { type PriceRuleLite } from '@/features/booking/lib/pricing';

export interface BranchSummary {
  id: string;
  slug: string;
  name: string;
  addressLine: string;
  district: string | null;
  city: string;
  opensAt: string;
  closesAt: string;
  coverImagePath: string | null;
  courtCount: number;
  minPrice: number | null;
}

export type QueryResult<T> = { ok: true; data: T } | { ok: false; reason: 'not_configured' | 'error' };

const fetchPublishedBranches = unstable_cache(
  async (): Promise<BranchSummary[]> => {
    const { data, error } = await createPublicClient().rpc('list_published_branches');
    if (error) throw new Error(error.message); // lỗi không được lưu vào cache
    return data.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      addressLine: b.address_line,
      district: b.district,
      city: b.city,
      opensAt: b.opens_at,
      closesAt: b.closes_at,
      coverImagePath: b.cover_image_path,
      courtCount: b.active_court_count,
      minPrice: b.min_price_per_hour,
    }));
  },
  ['published-branches'],
  { tags: [PUBLIC_TAGS.branches], revalidate: PUBLIC_REVALIDATE.branches },
);

/** Chi nhánh đã công bố (cache phía máy chủ; xóa cache khi admin sửa chi nhánh/sân/giá). */
export const listPublishedBranches = cache(async (): Promise<QueryResult<BranchSummary[]>> => {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    return { ok: true, data: await fetchPublishedBranches() };
  } catch {
    return { ok: false, reason: 'error' };
  }
});

export interface CourtPublic {
  id: string;
  name: string;
  status: Tables<'courts'>['status'];
  isIndoor: boolean;
  surface: string | null;
  description: string | null;
  photos: Array<{ path: string; alt: string | null }>;
}

export interface BranchDetail {
  branch: Pick<
    Tables<'branches'>,
    | 'id'
    | 'slug'
    | 'name'
    | 'address_line'
    | 'ward'
    | 'district'
    | 'city'
    | 'phone'
    | 'map_url'
    | 'timezone'
    | 'opens_at'
    | 'closes_at'
    | 'slot_minutes'
    | 'hold_minutes'
    | 'min_booking_minutes'
    | 'max_booking_minutes'
    | 'booking_window_days'
    | 'deposit_percent'
    | 'free_cancel_hours'
    | 'partial_refund_hours'
    | 'partial_refund_percent'
    | 'description'
    | 'parking_info'
    | 'house_rules'
    | 'cover_image_path'
  >;
  courts: CourtPublic[];
  amenities: Array<{ code: string; label: string; icon: string | null }>;
  priceRules: Array<PriceRuleLite & { label: string | null }>;
}

const fetchBranchDetail = unstable_cache(
  async (slug: string): Promise<BranchDetail | null> => {
    const supabase = createPublicClient();
    const { data: branch, error } = await supabase
      .from('branches')
      .select(
        'id, slug, name, address_line, ward, district, city, phone, map_url, timezone, opens_at, closes_at, slot_minutes, hold_minutes, min_booking_minutes, max_booking_minutes, booking_window_days, deposit_percent, free_cancel_hours, partial_refund_hours, partial_refund_percent, description, parking_info, house_rules, cover_image_path',
      )
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!branch) return null;

    const [courtsRes, amenitiesRes, rulesRes] = await Promise.all([
      supabase
        .from('courts')
        .select(
          'id, name, status, is_indoor, description, sort_order, court_surfaces(label), court_photos(storage_path, alt_text, sort_order, is_cover)',
        )
        .eq('branch_id', branch.id)
        .order('sort_order')
        .order('name'),
      supabase.from('branch_amenities').select('amenity_code, amenities(code, label, icon, sort_order)').eq('branch_id', branch.id),
      supabase
        .from('price_rules')
        .select('id, court_id, label, days_mask, starts_at, ends_at, price_per_hour, priority, valid_from, valid_until, created_at')
        .eq('branch_id', branch.id)
        .order('starts_at'),
    ]);

    const courts: CourtPublic[] = (courtsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      isIndoor: c.is_indoor,
      surface: c.court_surfaces?.label ?? null,
      description: c.description,
      photos: [...c.court_photos]
        .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
        .map((p) => ({ path: p.storage_path, alt: p.alt_text })),
    }));

    const amenities = (amenitiesRes.data ?? [])
      .flatMap((row) => (row.amenities ? [row.amenities] : []))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => ({ code: a.code, label: a.label, icon: a.icon }));

    if (courtsRes.error || rulesRes.error) throw new Error('branch_detail_failed');
    return { branch, courts, amenities, priceRules: rulesRes.data ?? [] };
  },
  ['branch-detail'],
  { tags: [PUBLIC_TAGS.branches], revalidate: PUBLIC_REVALIDATE.branches },
);

export const getBranchDetail = cache(async (slug: string): Promise<BranchDetail | null> => {
  if (!isSupabaseConfigured()) return null;
  return fetchBranchDetail(slug).catch(() => null);
});
