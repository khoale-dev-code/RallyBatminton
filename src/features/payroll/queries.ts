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
  /** Phần tăng ca (đã gồm trong basePay). */
  overtimeMinutes: number;
  overtimePay: number;
  pendingOvertime: number;
}

export async function getPayrollMonth(month: string) {
  const supabase = await createClient();
  // Một lượt song song: kỳ lương (kèm dòng lương nếu đã chốt) + các khoản điều chỉnh.
  const [periodRes, { data: adjustments }] = await Promise.all([
    supabase
      .from('payroll_periods')
      .select(
        'id, closed_at, note, payroll_lines(employee_id, employee_code, employee_name, shifts_count, paid_minutes, base_pay, adjustments_total, net_pay, overtime_minutes, overtime_pay)',
      )
      .eq('month', month)
      .order('employee_name', { referencedTable: 'payroll_lines' })
      .maybeSingle(),
    supabase
      .from('payroll_adjustments')
      .select('id, amount, reason, created_at, voided_at, employees(full_name, code)')
      .eq('month', month)
      .order('created_at', { ascending: false }),
  ]);
  if (periodRes.error) throw periodRes.error;
  const closedPeriod = periodRes.data;
  const period = closedPeriod ? { id: closedPeriod.id, closed_at: closedPeriod.closed_at, note: closedPeriod.note } : null;

  let rows: PayrollRow[];
  if (closedPeriod) {
    rows = closedPeriod.payroll_lines.map((l) => ({
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
      overtimeMinutes: l.overtime_minutes,
      overtimePay: l.overtime_pay,
      pendingOvertime: 0,
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
      overtimeMinutes: l.overtime_minutes,
      overtimePay: l.overtime_pay,
      pendingOvertime: l.pending_overtime,
    }));
  }

  return {
    period,
    rows,
    adjustments: adjustments ?? [],
    totals: {
      net: rows.reduce((n, r) => n + r.netPay, 0),
      unresolved: rows.reduce((n, r) => n + r.unresolved, 0),
      missingRate: rows.reduce((n, r) => n + r.missingRate, 0),
      overtimePay: rows.reduce((n, r) => n + r.overtimePay, 0),
      overtimeMinutes: rows.reduce((n, r) => n + r.overtimeMinutes, 0),
      pendingOvertime: rows.reduce((n, r) => n + r.pendingOvertime, 0),
    },
  };
}

export async function listEmployeesForPayroll() {
  const supabase = await createClient();
  const { data } = await supabase.from('employees').select('id, code, full_name').order('full_name');
  return data ?? [];
}
