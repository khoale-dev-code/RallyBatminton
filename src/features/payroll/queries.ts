import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface PayrollRow {
  employeeId: string;
  code: string;
  name: string;
  shifts: number;
  paidMinutes: number;
  basePay: number;
  adjustments: number;
  netPay: number;
  unresolved: number;
  missingRate: number;
}

export async function getPayrollMonth(month: string) {
  const supabase = await createClient();
  const { data: period } = await supabase.from('payroll_periods').select('id, closed_at, note').eq('month', month).maybeSingle();

  let rows: PayrollRow[];
  if (period) {
    const { data, error } = await supabase
      .from('payroll_lines')
      .select('employee_id, employee_code, employee_name, shifts_count, paid_minutes, base_pay, adjustments_total, net_pay')
      .eq('period_id', period.id)
      .order('employee_name');
    if (error) throw error;
    rows = (data ?? []).map((l) => ({
      employeeId: l.employee_id,
      code: l.employee_code,
      name: l.employee_name,
      shifts: l.shifts_count,
      paidMinutes: l.paid_minutes,
      basePay: l.base_pay,
      adjustments: l.adjustments_total,
      netPay: l.net_pay ?? l.base_pay + l.adjustments_total,
      unresolved: 0,
      missingRate: 0,
    }));
  } else {
    const { data, error } = await supabase.rpc('preview_payroll_month', { p_month: month });
    if (error) throw error;
    rows = (data ?? []).map((l) => ({
      employeeId: l.employee_id,
      code: l.employee_code,
      name: l.employee_name,
      shifts: l.shifts_count,
      paidMinutes: l.paid_minutes,
      basePay: l.base_pay,
      adjustments: l.adjustments_total,
      netPay: l.net_pay,
      unresolved: l.unresolved_shifts,
      missingRate: l.missing_rate_shifts,
    }));
  }

  const { data: adjustments } = await supabase
    .from('payroll_adjustments')
    .select('id, amount, reason, created_at, voided_at, employees(full_name, code)')
    .eq('month', month)
    .order('created_at', { ascending: false });

  return {
    period,
    rows,
    adjustments: adjustments ?? [],
    totals: {
      net: rows.reduce((n, r) => n + r.netPay, 0),
      unresolved: rows.reduce((n, r) => n + r.unresolved, 0),
      missingRate: rows.reduce((n, r) => n + r.missingRate, 0),
    },
  };
}

export async function listEmployeesForPayroll() {
  const supabase = await createClient();
  const { data } = await supabase.from('employees').select('id, code, full_name').order('full_name');
  return data ?? [];
}
