import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const num = z.coerce.number();

const bookingsSchema = z.object({
  total: num,
  held: num,
  confirmed: num,
  checked_in: num,
  completed: num,
  cancelled: num,
  occupancy: num,
  new_online: num,
  upcoming: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      status: z.string(),
      contact_name: z.string().nullable(),
      starts_at: z.string(),
      ends_at: z.string(),
      court_name: z.string(),
      branch_name: z.string(),
    }),
  ),
  awaiting_deposit: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      contact_name: z.string().nullable(),
      starts_at: z.string(),
      hold_expires_at: z.string(),
      deposit_amount: num,
      paid_amount: num,
      court_name: z.string(),
      branch_name: z.string(),
    }),
  ),
});

const cashSchema = z.object({
  today_in: num,
  today_refund: num,
  today_net: num,
  period_net: num,
  period_refund: num,
  prev_net: num,
  receivable: num,
  by_source: z.object({ booking: num, sale: num, rental: num }),
  by_method: z.record(z.string(), num),
  series: z.array(z.object({ day: z.string(), booking: num, sale: num, rental: num, refund: num })),
  recent: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['charge', 'refund']),
      method: z.string(),
      amount: num,
      received_at: z.string(),
      provider: z.string().nullable(),
      ref_code: z.string().nullable(),
      source: z.enum(['booking', 'sale', 'rental']),
      booking_id: z.string().nullable(),
      sale_id: z.string().nullable(),
      rental_id: z.string().nullable(),
    }),
  ),
});

const bankSchema = z.object({
  today_count: num,
  today_amount: num,
  auto_matched_period: num,
  pending: num,
  pending_list: z.array(
    z.object({
      id: z.string(),
      amount: num,
      content: z.string().nullable(),
      status: z.string(),
      status_note: z.string().nullable(),
      transaction_at: z.string(),
    }),
  ),
});

const dashboardSchema = z.object({
  today: z.string(),
  days: num,
  is_owner: z.boolean(),
  scope: z.enum(['all', 'branch']),
  bookings: bookingsSchema.optional(),
  cash: cashSchema.optional(),
  bank: bankSchema.optional(),
  sales: z
    .object({
      today_count: num,
      today_total: num,
      period_count: num,
      period_total: num,
      top: z.array(z.object({ name: z.string(), qty: num, total: num })),
    })
    .optional(),
  rentals: z
    .object({
      out: num,
      overdue: num,
      today_new: num,
      overdue_list: z.array(z.object({ id: z.string(), code: z.string(), due_at: z.string(), customer: z.string().nullable() })),
    })
    .optional(),
  stock: z
    .object({
      low: num,
      out: num,
      list: z.array(
        z.object({
          variant_id: z.string(),
          name: z.string(),
          size: z.string().nullable(),
          color: z.string().nullable(),
          on_hand: num,
          reorder: num,
          branch_name: z.string(),
        }),
      ),
    })
    .optional(),
  staff: z.object({ on_shift: num, scheduled_today: num, late: num }).optional(),
  members: z.object({ total: num, new_period: num }).optional(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
export type CashSeriesPoint = NonNullable<Dashboard['cash']>['series'][number];

export const DASHBOARD_PERIODS = [7, 30, 90] as const;

/** Số liệu Tổng quan trong MỘT lần gọi database (quyền từng phần do database quyết định). */
export async function getDashboard(branchId: string | null, days: number): Promise<Dashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_dashboard', { p_branch_id: branchId ?? undefined, p_days: days });
  if (error) return null;
  const parsed = dashboardSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[dashboard] Dữ liệu không đúng dạng:', parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data;
}

/** Ca làm sắp tới của chính người xem. */
export async function getNextShift(employeeId: string | null) {
  if (!employeeId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('shifts')
    .select('id, scheduled_start, scheduled_end, status, checked_in_at, branches(name)')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .gte('scheduled_end', new Date().toISOString())
    .order('scheduled_start')
    .limit(1)
    .maybeSingle();
  return data;
}
