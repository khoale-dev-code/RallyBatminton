import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { addDays } from '@/lib/time';

/** Dữ liệu cá nhân của nhân viên — RLS chỉ trả hàng của chính họ. */
export async function getMyOverview(employeeId: string, fromDate: string) {
  const supabase = await createClient();
  const [{ data: employee }, { data: shifts }, { data: lines }, { data: rates }, { data: adjustments }] = await Promise.all([
    supabase.from('employees').select('full_name, code, branches(name)').eq('id', employeeId).maybeSingle(),
    supabase
      .from('shifts')
      .select(
        'id, work_date, scheduled_start, scheduled_end, status, checked_in_at, checked_out_at, paid_minutes, branches(name, timezone), shift_overtime(id, minutes, hourly_rate, reason, status, requested_at)',
      )
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .gte('work_date', addDays(fromDate, -14))
      .lte('work_date', addDays(fromDate, 21))
      .order('scheduled_start'),
    supabase
      .from('payroll_lines')
      .select(
        'period_id, shifts_count, paid_minutes, base_pay, adjustments_total, net_pay, overtime_minutes, overtime_pay, payroll_periods(month)',
      )
      .eq('employee_id', employeeId)
      .limit(12),
    supabase
      .from('employee_pay_rates')
      .select('pay_type, hourly_rate, daily_rate, effective_from')
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false })
      .limit(1),
    supabase
      .from('payroll_adjustments')
      .select('id, month, amount, reason, voided_at')
      .eq('employee_id', employeeId)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  return {
    employee,
    shifts: shifts ?? [],
    payslips: [...(lines ?? [])].sort((a, b) => (b.payroll_periods?.month ?? '').localeCompare(a.payroll_periods?.month ?? '')),
    rate: rates?.[0] ?? null,
    adjustments: adjustments ?? [],
  };
}

const summarySchema = z.object({
  month: z.string(),
  closed: z.boolean(),
  shifts_done: z.number(),
  shifts_upcoming: z.number(),
  upcoming_minutes: z.number(),
  absent_count: z.number(),
  leave_count: z.number(),
  paid_minutes: z.number(),
  late_count: z.number(),
  late_minutes: z.number(),
  overtime_count: z.number(),
  overtime_minutes: z.number(),
  overtime_pay: z.number(),
  regular_pay: z.number(),
  bonus: z.number(),
  penalty: z.number(),
  net_pay: z.number(),
  missing_rate: z.number(),
  pending_overtime: z.number(),
  adjustments: z.array(z.object({ id: z.string(), amount: z.number(), reason: z.string(), created_at: z.string() })).catch([]),
});
export type MonthSummary = z.infer<typeof summarySchema>;

/** Tổng quan tháng của chính nhân viên (RPC my_month_summary). Chưa chạy SQL 19 → null. */
export async function getMyMonthSummary(month: string): Promise<MonthSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_month_summary', { p_month: month });
  if (error) {
    console.error('[me] Không đọc được tổng quan tháng (đã chạy 19_staff_checkout.sql?):', error.message);
    return null;
  }
  const parsed = summarySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
