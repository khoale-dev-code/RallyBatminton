import 'server-only';

import { createClient } from '@/lib/supabase/server';

export async function listAllBranches() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branches')
    .select('id, slug, name, address_line, district, status, opens_at, closes_at, courts(id, status)')
    .order('name');
  return data ?? [];
}

export async function getBranchForEdit(id: string) {
  const supabase = await createClient();
  const [{ data: branch }, { data: amenities }, { data: selected }, { data: problems }] = await Promise.all([
    supabase.from('branches').select('*').eq('id', id).maybeSingle(),
    supabase.from('amenities').select('code, label').order('sort_order'),
    supabase.from('branch_amenities').select('amenity_code').eq('branch_id', id),
    supabase.rpc('branch_publish_checklist', { p_branch_id: id }),
  ]);
  if (!branch) return null;
  return {
    branch,
    amenities: amenities ?? [],
    selectedAmenities: (selected ?? []).map((a) => a.amenity_code),
    publishProblems: problems ?? [],
  };
}

export async function getBranchCourts(branchId: string) {
  const supabase = await createClient();
  const [{ data: branch }, { data: courts }, { data: surfaces }] = await Promise.all([
    supabase.from('branches').select('id, name, slug, status').eq('id', branchId).maybeSingle(),
    supabase
      .from('courts')
      .select('id, name, status, is_indoor, sort_order, surface_code, description, court_photos(id)')
      .eq('branch_id', branchId)
      .order('sort_order')
      .order('name'),
    supabase.from('court_surfaces').select('code, label').order('sort_order'),
  ]);
  if (!branch) return null;
  return { branch, courts: courts ?? [], surfaces: surfaces ?? [] };
}

export async function getCourtForEdit(courtId: string) {
  const supabase = await createClient();
  const [{ data: court }, { data: surfaces }] = await Promise.all([
    supabase
      .from('courts')
      .select('*, branches(id, name), court_photos(id, storage_path, alt_text, sort_order, is_cover, created_at)')
      .eq('id', courtId)
      .maybeSingle(),
    supabase.from('court_surfaces').select('code, label').order('sort_order'),
  ]);
  if (!court) return null;
  return { court, surfaces: surfaces ?? [] };
}

export async function getBranchPricing(branchId: string) {
  const supabase = await createClient();
  const [{ data: branch }, { data: rules }, { data: courts }] = await Promise.all([
    supabase.from('branches').select('id, name, opens_at, closes_at, slot_minutes').eq('id', branchId).maybeSingle(),
    supabase
      .from('price_rules')
      .select(
        'id, court_id, label, days_mask, starts_at, ends_at, price_per_hour, priority, valid_from, valid_until, is_active, created_at',
      )
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('is_active', { ascending: false })
      .order('starts_at'),
    supabase.from('courts').select('id, name, status').eq('branch_id', branchId).neq('status', 'retired').order('sort_order'),
  ]);
  if (!branch) return null;
  return { branch, rules: rules ?? [], courts: courts ?? [] };
}
