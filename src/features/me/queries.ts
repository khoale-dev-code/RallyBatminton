import 'server-only';

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
        'id, work_date, scheduled_start, scheduled_end, status, checked_in_at, checked_out_at, paid_minutes, branches(name, timezone)',
      )
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .gte('work_date', addDays(fromDate, -14))
      .lte('work_date', addDays(fromDate, 21))
      .order('scheduled_start'),
    supabase
      .from('payroll_lines')
      .select('period_id, shifts_count, paid_minutes, base_pay, adjustments_total, net_pay, payroll_periods(month)')
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
