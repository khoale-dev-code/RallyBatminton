import 'server-only';

import { cache } from 'react';

import { mapDirectionsHref, mapEmbedSrc } from '@/features/branches/lib/map-embed';
import { listPublishedBranches, type QueryResult } from '@/features/branches/queries';
import { createPublicClient } from '@/lib/supabase/public';

export interface AboutBranch {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string | null;
  opensAt: string;
  closesAt: string;
  courtCount: number;
  minPrice: number | null;
  description: string | null;
  parkingInfo: string | null;
  coverImagePath: string | null;
  mapSrc: string;
  directionsHref: string;
  amenities: string[];
}

export interface AboutData {
  branches: AboutBranch[];
  amenities: Array<{ code: string; label: string; icon: string | null; branchCount: number }>;
  totals: { branches: number; courts: number; minPrice: number | null; openHours: number };
}

function hoursOpen(opensAt: string, closesAt: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.round((toMin(closesAt) - toMin(opensAt)) / 60);
}

/** Dữ liệu trang Giới thiệu: chi nhánh (bản đồ nhúng, tiện ích) + số liệu tổng. */
export const getAboutData = cache(async (): Promise<QueryResult<AboutData>> => {
  const list = await listPublishedBranches();
  if (!list.ok) return list;
  const ids = list.data.map((b) => b.id);
  if (ids.length === 0) {
    return { ok: true, data: { branches: [], amenities: [], totals: { branches: 0, courts: 0, minPrice: null, openHours: 0 } } };
  }
  const supabase = createPublicClient();
  const [{ data: rows, error }, { data: links }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, address_line, ward, district, city, phone, map_url, map_embed_url, description, parking_info')
      .in('id', ids),
    supabase.from('branch_amenities').select('branch_id, amenities(code, label, icon, sort_order)').in('branch_id', ids),
  ]);
  if (error) return { ok: false, reason: 'error' };

  const amenityMap = new Map<string, { code: string; label: string; icon: string | null; sort: number; branches: Set<string> }>();
  const perBranch = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (!l.amenities) continue;
    const a = l.amenities;
    const entry = amenityMap.get(a.code) ?? { code: a.code, label: a.label, icon: a.icon, sort: a.sort_order, branches: new Set<string>() };
    entry.branches.add(l.branch_id);
    amenityMap.set(a.code, entry);
    perBranch.set(l.branch_id, [...(perBranch.get(l.branch_id) ?? []), a.label]);
  }

  const branches: AboutBranch[] = list.data.map((b) => {
    const row = rows?.find((r) => r.id === b.id);
    const address = [row?.address_line ?? b.addressLine, row?.ward, row?.district ?? b.district, row?.city ?? b.city]
      .filter(Boolean)
      .join(', ');
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      address,
      phone: row?.phone ?? null,
      opensAt: b.opensAt,
      closesAt: b.closesAt,
      courtCount: b.courtCount,
      minPrice: b.minPrice,
      description: row?.description ?? null,
      parkingInfo: row?.parking_info ?? null,
      coverImagePath: b.coverImagePath,
      mapSrc: mapEmbedSrc(row?.map_embed_url, `${b.name}, ${address}`),
      directionsHref: mapDirectionsHref(row?.map_url, `${b.name}, ${address}`),
      amenities: perBranch.get(b.id) ?? [],
    };
  });

  return {
    ok: true,
    data: {
      branches,
      amenities: [...amenityMap.values()]
        .sort((a, b) => a.sort - b.sort)
        .map((a) => ({ code: a.code, label: a.label, icon: a.icon, branchCount: a.branches.size })),
      totals: {
        branches: branches.length,
        courts: branches.reduce((n, b) => n + b.courtCount, 0),
        minPrice: branches.reduce<number | null>((m, b) => (b.minPrice !== null && (m === null || b.minPrice < m) ? b.minPrice : m), null),
        openHours: Math.max(0, ...branches.map((b) => hoursOpen(b.opensAt, b.closesAt))),
      },
    },
  };
});
