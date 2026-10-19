import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays, parseTstzRange, zonedToUtc } from '@/lib/time';

export async function getBookingDay(branchId: string, dateKey: string) {
  const supabase = await createClient();
  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, timezone, opens_at, closes_at, slot_minutes')
    .eq('id', branchId)
    .maybeSingle();
  if (!branch) return null;
  const from = zonedToUtc(dateKey, '00:00', branch.timezone).toISOString();
  const to = zonedToUtc(addDays(dateKey, 1), '00:00', branch.timezone).toISOString();
  const [{ data: courts }, { data: bookings }] = await Promise.all([
    supabase.from('courts').select('id, name, status').eq('branch_id', branchId).neq('status', 'retired').order('sort_order').order('name'),
    supabase
      .from('bookings')
      .select(
        'id, code, status, kind, source, court_id, during, contact_name, total_amount, deposit_amount, hold_expires_at, internal_note, customers(phone)',
      )
      .eq('branch_id', branchId)
      .overlaps('during', `[${from},${to})`)
      .is('deleted_at', null)
      .order('during'),
  ]);
  const ids = (bookings ?? []).map((b) => b.id);
  const { data: balances } = ids.length
    ? await supabase.from('booking_balances').select('booking_id, paid_amount, balance_due').in('booking_id', ids)
    : { data: [] };
  const balanceById = new Map((balances ?? []).map((b) => [b.booking_id, b]));

  return {
    branch,
    courts: courts ?? [],
    bookings: (bookings ?? []).flatMap((b) => {
      const range = parseTstzRange(b.during);
      if (!range) return [];
      const bal = balanceById.get(b.id);
      return [
        {
          ...b,
          start: range.start,
          end: range.end,
          paid: bal?.paid_amount ?? 0,
          balance: bal?.balance_due ?? b.total_amount ?? 0,
          total: b.total_amount ?? 0,
        },
      ];
    }),
  };
}

export type DayBooking = NonNullable<Awaited<ReturnType<typeof getBookingDay>>>['bookings'][number];

export async function getBookingDetail(id: string) {
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `*, courts(id, name, branch_id, branches(id, name, timezone, opens_at, closes_at, slot_minutes)),
       customers(id, full_name, phone, staff_note)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!booking) return null;
  const [{ data: payments }, { data: balance }, { data: courts }, { data: audit }] = await Promise.all([
    supabase
      .from('payments')
      .select('id, kind, method, status, amount, reference, note, received_at, void_reason')
      .eq('booking_id', id)
      .order('received_at'),
    supabase.from('booking_balances').select('paid_amount, refunded_amount, balance_due').eq('booking_id', id).maybeSingle(),
    supabase.from('courts').select('id, name').eq('branch_id', booking.branch_id).eq('status', 'active').order('sort_order'),
    supabase
      .from('audit_events')
      .select('id, occurred_at, action, reason, new_data')
      .eq('table_name', 'bookings')
      .eq('record_id', id)
      .order('occurred_at', { ascending: false })
      .limit(20),
  ]);
  const range = parseTstzRange(booking.during);
  return { booking, range, payments: payments ?? [], balance, courts: courts ?? [], audit: audit ?? [] };
}

export async function listCourtsForBranch(branchId: string) {
  const supabase = await createClient();
  const [{ data: branch }, { data: courts }] = await Promise.all([
    supabase.from('branches').select('id, name, timezone, opens_at, closes_at').eq('id', branchId).maybeSingle(),
    supabase.from('courts').select('id, name, status').eq('branch_id', branchId).eq('status', 'active').order('sort_order'),
  ]);
  return { branch, courts: courts ?? [] };
}
