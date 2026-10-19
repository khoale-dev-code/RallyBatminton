import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { parseTstzRange } from '@/lib/time';

const TIERS = ['member', 'silver', 'gold', 'diamond'] as const;
const LOGIN_KINDS = ['phone', 'email', 'google'] as const;

export async function searchCustomers(q: string | undefined) {
  const supabase = await createClient();
  let query = supabase
    .from('customers')
    .select('id, full_name, phone, created_at, marketing_opt_in, auth_user_id')
    .order('created_at', { ascending: false })
    .limit(50);
  const term = q?.trim().replace(/[%,()]/g, '');
  if (term) {
    const digits = term.replace(/\D/g, '');
    query = digits.length >= 4 ? query.ilike('phone', `%${digits}%`) : query.ilike('full_name', `%${term}%`);
  }
  const { data } = await query;
  const customers = data ?? [];
  // Hạng thành viên của khách đã liên kết tài khoản.
  const memberIds = customers.map((c) => c.auth_user_id).filter((id): id is string => Boolean(id));
  const tiers = new Map<string, { tier: (typeof TIERS)[number]; points: number }>();
  if (memberIds.length > 0) {
    const { data: members } = await supabase.from('member_profiles').select('user_id, tier, points').in('user_id', memberIds);
    for (const m of members ?? []) tiers.set(m.user_id, { tier: m.tier, points: m.points });
  }
  return customers.map((c) => ({ ...c, member: c.auth_user_id ? (tiers.get(c.auth_user_id) ?? null) : null }));
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!customer) return null;
  const [{ data: bookings }, { data: rentals }, { data: sales }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, code, status, during, total_amount, courts(name, branches(name))')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('rentals')
      .select('id, code, status, starts_at, rental_fee, late_fee, damage_fee, products(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    // Hóa đơn mua hàng tại quầy (RLS: chỉ chi nhánh có quyền bán hàng).
    supabase
      .from('sales')
      .select('id, code, status, sold_at, total_amount, branches(name), sale_lines(product_name, quantity)')
      .eq('customer_id', id)
      .order('sold_at', { ascending: false })
      .limit(100),
  ]);
  const playedStatuses = new Set(['checked_in', 'completed']);
  const bookingList = (bookings ?? []).map((b) => ({ ...b, range: parseTstzRange(b.during) }));
  const saleList = sales ?? [];
  const rentalList = rentals ?? [];
  const spent =
    bookingList.filter((b) => playedStatuses.has(b.status)).reduce((n, b) => n + (b.total_amount ?? 0), 0) +
    saleList.filter((s) => s.status === 'completed').reduce((n, s) => n + (s.total_amount ?? 0), 0) +
    rentalList.filter((r) => r.status !== 'voided').reduce((n, r) => n + (r.rental_fee ?? 0) + r.late_fee + r.damage_fee, 0);
  return {
    customer,
    bookings: bookingList,
    rentals: rentalList,
    sales: saleList,
    stats: {
      spent,
      played: bookingList.filter((b) => b.status === 'completed').length,
      noShow: bookingList.filter((b) => b.status === 'no_show').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Thành viên (tài khoản khách)
// ---------------------------------------------------------------------------
const memberRowSchema = z.object({
  user_id: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  login_kind: z.enum(LOGIN_KINDS),
  points: z.number(),
  lifetime_points: z.number(),
  tier: z.enum(TIERS),
  is_locked: z.boolean(),
  booking_count: z.number(),
  customer_id: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  created_at: z.string(),
});

const memberListSchema = z.object({
  total: z.number(),
  rows: z.array(memberRowSchema),
  summary: z.object({ members: z.number(), new_30d: z.number(), with_phone: z.number(), locked: z.number() }),
});

export type MemberRow = z.infer<typeof memberRowSchema>;
export type MemberList = z.infer<typeof memberListSchema>;

export const MEMBER_FILTERS = ['all', 'silver', 'gold', 'diamond', 'no_phone', 'locked'] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];
export const MEMBER_PAGE_SIZE = 30;

export async function listMembers(q: string | undefined, filter: MemberFilter, page: number): Promise<MemberList | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_members', {
    p_query: q?.trim() || null,
    p_filter: filter,
    p_limit: MEMBER_PAGE_SIZE,
    p_offset: Math.max(0, page - 1) * MEMBER_PAGE_SIZE,
  });
  if (error) return null;
  const parsed = memberListSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const memberDetailSchema = z.object({
  user_id: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  login_kind: z.enum(LOGIN_KINDS),
  points: z.number(),
  lifetime_points: z.number(),
  tier: z.enum(TIERS),
  is_locked: z.boolean(),
  must_change_password: z.boolean(),
  has_password: z.boolean(),
  marketing_opt_in: z.boolean(),
  created_at: z.string(),
  staff_note: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
  last_seen_at: z.string().nullable(),
  providers: z.array(z.string()),
  customer: z.object({ id: z.string(), full_name: z.string(), phone: z.string() }).nullable(),
  stats: z.object({ bookings: z.number(), completed: z.number(), no_show: z.number(), spent: z.number() }),
});

export type MemberDetail = z.infer<typeof memberDetailSchema>;

export async function getMember(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_get_member', { p_user_id: userId });
  if (error || data === null) return null;
  const parsed = memberDetailSchema.safeParse(data);
  if (!parsed.success) return null;
  const [{ data: bookings }, { data: ledger }] = await Promise.all([
    // Nhân viên chỉ thấy đơn ở chi nhánh mình (RLS).
    supabase
      .from('bookings')
      .select('id, code, status, during, total_amount, courts(name, branches(name))')
      .eq('member_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('member_point_ledger')
      .select('id, kind, delta, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  return {
    member: parsed.data,
    bookings: (bookings ?? []).map((b) => ({ ...b, range: parseTstzRange(b.during) })),
    ledger: ledger ?? [],
  };
}

/** Thành viên liên kết với một hồ sơ khách (trang chi tiết khách). */
export async function getLinkedMember(authUserId: string | null) {
  if (!authUserId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('member_profiles')
    .select('user_id, full_name, tier, points, lifetime_points, login_kind, is_locked, created_at')
    .eq('user_id', authUserId)
    .maybeSingle();
  return data;
}
