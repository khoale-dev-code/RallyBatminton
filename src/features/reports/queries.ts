import 'server-only';

import { z } from 'zod';

import { toUserMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/** Báo cáo cho chủ sân (27_owner_reports.sql). Database kiểm quyền chủ sân; ở đây chỉ kiểm dạng dữ liệu. */

const num = z.coerce.number();
const str = z.string();
const nstr = z.string().nullable();

export const revenueSchema = z.object({
  from: str,
  to: str,
  days: num,
  charge: num,
  refund: num,
  net: num,
  count: num,
  prev_net: num,
  by_source: z.object({ booking: num, sale: num, rental: num }),
  by_method: z.record(z.string(), num),
  series: z.array(z.object({ day: str, booking: num, sale: num, rental: num, refund: num })),
  by_branch: z.array(z.object({ id: str, name: str, booking: num, sale: num, rental: num, net: num })),
  by_court: z.array(z.object({ id: str, name: str, branch: str, net: num })),
});
export type RevenueReport = z.infer<typeof revenueSchema>;

const minutesRow = { capacity: num, booked: num };
export const occupancySchema = z.object({
  from: str,
  to: str,
  days: num,
  capacity_minutes: num,
  booked_minutes: num,
  bookings: num,
  courts: num,
  heatmap: z.array(z.object({ dow: num, h: num, ...minutesRow })),
  by_court: z.array(z.object({ id: str, name: str, branch: str, bookings: num, ...minutesRow })),
  by_branch: z.array(z.object({ id: str, name: str, ...minutesRow })),
});
export type OccupancyReport = z.infer<typeof occupancySchema>;

export const customersSchema = z.object({
  from: str,
  to: str,
  days: num,
  total: num,
  played: num,
  cancelled: num,
  no_show: num,
  expired_holds: num,
  by_source: z.record(z.string(), num),
  unique_customers: num,
  new_customers: num,
  returning_customers: num,
  repeat_customers: num,
  walk_in_bookings: num,
  lead_hours_median: num.nullable(),
  members_new: num,
  members_total: num,
  top: z.array(z.object({ id: str, name: str, bookings: num, spend: num, last_at: str })),
});
export type CustomersReport = z.infer<typeof customersSchema>;

export const productsSchema = z.object({
  from: str,
  to: str,
  days: num,
  orders: num,
  revenue: num,
  discount: num,
  items: num,
  offline_orders: num,
  top: z.array(z.object({ id: str, name: str, unit: nstr, category: nstr, qty: num, revenue: num, orders: num, cost: num.nullable() })),
  by_category: z.array(z.object({ name: str, revenue: num, qty: num })),
  slow_count: num,
  slow: z.array(z.object({ name: str, variant: nstr, branch: str, on_hand: num, last_sold_at: nstr })),
  low_stock: num,
  rentals: num,
  rental_revenue: num,
  rental_top: z.array(z.object({ name: str, rentals: num, fee: num })),
});
export type ProductsReport = z.infer<typeof productsSchema>;

export const cashSchema = z.object({
  from: str,
  to: str,
  days: num,
  cash_in: num,
  cash_refund: num,
  cash_net: num,
  non_cash_net: num,
  drawer: z.object({ total: num, manual: num, sale: num, booking_payment: num, rental: num }),
  offline_sales: num,
  offline_total: num,
  by_day: z.array(z.object({ day: str, cash_in: num, cash_refund: num })),
  by_cashier: z.array(
    z.object({
      user_id: str,
      name: str,
      cash_in: num,
      cash_refund: num,
      cash_count: num,
      other_net: num,
      drawer_auto: num,
      drawer_manual: num,
      offline_sales: num,
    }),
  ),
  shifts: z.array(z.object({ id: str, name: str, branch: str, start: str, end: str, cash_in: num, cash_refund: num, drawer_manual: num })),
  manual_opens: z.array(z.object({ at: str, name: str, branch: str, ref: nstr, device: nstr })),
});
export type CashReport = z.infer<typeof cashSchema>;

export type ReportResult<T> = { ok: true; data: T } | { ok: false; error: string; notInstalled: boolean };

type ReportFn = 'report_revenue' | 'report_occupancy' | 'report_customers' | 'report_products' | 'report_cash';

async function load<T>(fn: ReportFn, schema: z.ZodType<T>, from: string, to: string, branch: string | null): Promise<ReportResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, { p_from: from, p_to: to, p_branch_id: branch });
  if (error) {
    // Chưa chạy 27_owner_reports.sql: PostgREST không tìm thấy hàm.
    const notInstalled = error.code === 'PGRST202';
    return { ok: false, error: notInstalled ? '' : toUserMessage(error), notInstalled };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[reports] ${fn}: dữ liệu không đúng dạng`, parsed.error.issues.slice(0, 3));
    return { ok: false, error: 'Không đọc được số liệu báo cáo.', notInstalled: false };
  }
  return { ok: true, data: parsed.data };
}

export const getRevenueReport = (from: string, to: string, branch: string | null) =>
  load('report_revenue', revenueSchema, from, to, branch);
export const getOccupancyReport = (from: string, to: string, branch: string | null) =>
  load('report_occupancy', occupancySchema, from, to, branch);
export const getCustomersReport = (from: string, to: string, branch: string | null) =>
  load('report_customers', customersSchema, from, to, branch);
export const getProductsReport = (from: string, to: string, branch: string | null) =>
  load('report_products', productsSchema, from, to, branch);
export const getCashReport = (from: string, to: string, branch: string | null) => load('report_cash', cashSchema, from, to, branch);

/** Chi nhánh để chọn trong bộ lọc. */
export async function listReportBranches(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('id, name').is('deleted_at', null).order('name');
  return data ?? [];
}
