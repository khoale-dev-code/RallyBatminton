import 'server-only';

import { hasPermission, isOwner, type StaffBranch, type StaffContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { addDays, parseTstzRange, todayKey, zonedToUtc } from '@/lib/time';

export async function getDashboard(ctx: StaffContext, branch: StaffBranch | null) {
  const supabase = await createClient();
  const today = todayKey();
  const from = zonedToUtc(today, '00:00', 'Asia/Ho_Chi_Minh').toISOString();
  const to = zonedToUtc(addDays(today, 1), '00:00', 'Asia/Ho_Chi_Minh').toISOString();
  const nowIso = new Date().toISOString();
  const branchId = branch?.branchId ?? null;
  const can = (p: Parameters<typeof hasPermission>[1]) => Boolean(branchId) && hasPermission(ctx, p, branchId);

  const [bookingsRes, paymentsRes, stockRes, rentalsRes, shiftRes] = await Promise.all([
    can('booking.view')
      ? supabase
          .from('bookings')
          .select('id, code, status, kind, during, contact_name, hold_expires_at, courts(name)')
          .eq('branch_id', branchId ?? '')
          .overlaps('during', `[${from},${to})`)
          .is('deleted_at', null)
          .order('during')
      : Promise.resolve({ data: null }),
    can('payment.record') || isOwner(ctx)
      ? supabase
          .from('payments')
          .select('kind, amount')
          .eq('branch_id', branchId ?? '')
          .eq('status', 'succeeded')
          .gte('received_at', from)
          .lt('received_at', to)
      : Promise.resolve({ data: null }),
    can('catalog.view')
      ? supabase
          .from('inventory_levels')
          .select(
            'on_hand, reorder_level, product_variants(sku, size_label, color_label, products!product_variants_product_id_fkey(name, kind))',
          )
          .eq('branch_id', branchId ?? '')
          .eq('is_listed', true)
          .order('on_hand')
          .limit(200)
      : Promise.resolve({ data: null }),
    can('rental.operate')
      ? supabase
          .from('rentals')
          .select('id, code, due_at, customers(full_name)')
          .eq('branch_id', branchId ?? '')
          .eq('status', 'out')
          .order('due_at')
      : Promise.resolve({ data: null }),
    ctx.employeeId
      ? supabase
          .from('shifts')
          .select('id, scheduled_start, scheduled_end, status, checked_in_at, branches(name)')
          .eq('employee_id', ctx.employeeId)
          .is('deleted_at', null)
          .gte('scheduled_end', nowIso)
          .order('scheduled_start')
          .limit(1)
      : Promise.resolve({ data: null }),
  ]);

  const bookings = (bookingsRes.data ?? []).flatMap((b) => {
    const r = parseTstzRange(b.during);
    return r ? [{ ...b, start: r.start, end: r.end }] : [];
  });
  const revenue = paymentsRes.data ? paymentsRes.data.reduce((sum, p) => sum + (p.kind === 'charge' ? p.amount : -p.amount), 0) : null;
  const lowStock = (stockRes.data ?? []).filter((s) => s.on_hand <= s.reorder_level && s.product_variants?.products?.kind === 'sale');
  const now = Date.now();
  return {
    branchName: branch?.name ?? null,
    bookings: can('booking.view') ? bookings : null,
    revenue,
    lowStock: stockRes.data ? lowStock : null,
    rentalsOut: rentalsRes.data ?? null,
    overdue: (rentalsRes.data ?? []).filter((r) => new Date(r.due_at).getTime() < now),
    nextShift: shiftRes.data?.[0] ?? null,
  };
}
