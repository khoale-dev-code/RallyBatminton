import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays } from '@/lib/time';

const WEEK_SHIFT_COLUMNS =
  'id, work_date, scheduled_start, scheduled_end, break_minutes, status, checked_in_at, checked_out_at, paid_minutes, employee_id, employees(id, code, full_name), shift_overtime(id, minutes, status)';

/**
 * `colleagues`: người xem là nhân viên (không đọc được hồ sơ đồng nghiệp) → lấy tên + mã đồng nghiệp qua
 * `shift_people` CÙNG LƯỢT với truy vấn ca (thay vì chờ ca về rồi mới hỏi — bớt 1 lượt mạng).
 */
export async function getWeekShifts(branchId: string, weekStart: string, options: { colleagues?: boolean } = {}) {
  const supabase = await createClient();
  const weekEnd = addDays(weekStart, 6);
  const peopleQuery = () => supabase.rpc('shift_people', { p_branch_id: branchId, p_from: weekStart, p_to: weekEnd });
  const [{ data: branch }, { data: shifts, error }, early] = await Promise.all([
    supabase.from('branches').select('id, name, timezone').eq('id', branchId).maybeSingle(),
    supabase
      .from('shifts')
      .select(WEEK_SHIFT_COLUMNS)
      .eq('branch_id', branchId)
      .gte('work_date', weekStart)
      .lte('work_date', weekEnd)
      .is('deleted_at', null)
      .order('scheduled_start'),
    options.colleagues ? peopleQuery() : Promise.resolve(null),
  ]);
  if (error) throw error;
  const rows = shifts ?? [];
  // Nhân viên chỉ đọc được hồ sơ của chính mình: lấy tên đồng nghiệp qua hàm chỉ trả tên + mã.
  if (rows.some((s) => !s.employees)) {
    const { data: people } = early ?? (await peopleQuery());
    const byId = new Map((people ?? []).map((p) => [p.employee_id, { id: p.employee_id, code: p.code, full_name: p.full_name }]));
    return { branch, shifts: rows.map((s) => (s.employees ? s : { ...s, employees: byId.get(s.employee_id) ?? null })) };
  }
  return { branch, shifts: rows };
}

/** Ca của chính nhân viên trong tuần (mọi chi nhánh) — khi không có quyền xem lịch cả chi nhánh. */
export async function getMyWeekShifts(employeeId: string, weekStart: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(WEEK_SHIFT_COLUMNS)
    .eq('employee_id', employeeId)
    .gte('work_date', weekStart)
    .lte('work_date', addDays(weekStart, 6))
    .is('deleted_at', null)
    .order('scheduled_start');
  if (error) throw error;
  return data ?? [];
}

export async function listSchedulableEmployees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('id, code, full_name, home_branch_id, employee_pay_rates(id)')
    .eq('status', 'active')
    .order('full_name');
  return data ?? [];
}

export async function getShift(id: string) {
  const supabase = await createClient();
  // Nhật ký + tăng ca chỉ cần id ca → chạy cùng lượt với truy vấn ca (bớt 1 lượt mạng).
  const [{ data }, { data: history }, { data: overtime }] = await Promise.all([
    supabase.from('shifts').select('*, employees(id, code, full_name), branches(id, name, timezone)').eq('id', id).maybeSingle(),
    supabase
      .from('audit_events')
      .select('id, occurred_at, reason, action, old_data, new_data')
      .eq('table_name', 'shifts')
      .eq('record_id', id)
      .order('occurred_at', { ascending: false })
      .limit(20),
    supabase
      .from('shift_overtime')
      .select('id, minutes, hourly_rate, reason, status, consent, requested_at, responded_at, response_note')
      .eq('shift_id', id)
      .order('requested_at', { ascending: false }),
  ]);
  if (!data) return null;
  const [{ data: rates }, { data: closed }] = await Promise.all([
    supabase
      .from('employee_pay_rates')
      .select('pay_type, hourly_rate, daily_rate, standard_day_minutes, effective_from')
      .eq('employee_id', data.employee_id)
      .lte('effective_from', data.work_date)
      .order('effective_from', { ascending: false })
      .limit(1),
    supabase
      .from('payroll_periods')
      .select('id')
      .eq('month', `${data.work_date.slice(0, 7)}-01`)
      .maybeSingle(),
  ]);
  return {
    shift: data,
    history: history ?? [],
    overtime: overtime ?? [],
    rate: rates?.[0] ?? null,
    monthClosed: Boolean(closed),
  };
}
