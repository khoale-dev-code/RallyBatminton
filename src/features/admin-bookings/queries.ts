import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays, parseTstzRange, zonedToUtc } from '@/lib/time';

/** Tổng đã trả / còn nợ — cùng công thức với view booking_balances. */
function settle(total: number, payments: { amount: number; kind: string; status: string }[]) {
  let paid = 0;
  let refunded = 0;
  for (const p of payments) {
    if (p.status !== 'succeeded') continue;
    if (p.kind === 'charge') paid += p.amount;
    else if (p.kind === 'refund') refunded += p.amount;
  }
  return { paid, balance: total - paid + refunded };
}

/**
 * Lịch một ngày của chi nhánh — gọi song song 1 lượt (chi nhánh, sân, đơn kèm thanh toán).
 * Chưa biết múi giờ chi nhánh khi gọi nên lấy rộng ±1 ngày UTC rồi lọc đúng ngày sau.
 */
export async function getBookingDay(branchId: string, dateKey: string) {
  const supabase = await createClient();
  const wideFrom = `${addDays(dateKey, -1)}T00:00:00Z`;
  const wideTo = `${addDays(dateKey, 2)}T00:00:00Z`;
  const [{ data: branch }, { data: courts }, { data: bookings }] = await Promise.all([
    supabase.from('branches').select('id, name, timezone, opens_at, closes_at, slot_minutes').eq('id', branchId).maybeSingle(),
    supabase.from('courts').select('id, name, status').eq('branch_id', branchId).neq('status', 'retired').order('sort_order').order('name'),
    supabase
      .from('bookings')
      .select(
        'id, code, status, kind, source, court_id, during, contact_name, total_amount, deposit_amount, hold_expires_at, internal_note, customers(phone), payments(amount, kind, status)',
      )
      .eq('branch_id', branchId)
      .overlaps('during', `[${wideFrom},${wideTo})`)
      .is('deleted_at', null)
      .order('during'),
  ]);
  if (!branch) return null;
  const from = zonedToUtc(dateKey, '00:00', branch.timezone).getTime();
  const to = zonedToUtc(addDays(dateKey, 1), '00:00', branch.timezone).getTime();

  return {
    branch,
    courts: courts ?? [],
    bookings: (bookings ?? []).flatMap(({ payments, ...b }) => {
      const range = parseTstzRange(b.during);
      if (!range || range.start.getTime() >= to || range.end.getTime() <= from) return [];
      const total = b.total_amount ?? 0;
      const { paid, balance } = settle(total, payments);
      return [{ ...b, start: range.start, end: range.end, paid, balance, total }];
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
