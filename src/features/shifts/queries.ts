import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays } from '@/lib/time';

export async function getWeekShifts(branchId: string, weekStart: string) {
  const supabase = await createClient();
  const [{ data: branch }, { data: shifts, error }] = await Promise.all([
    supabase.from('branches').select('id, name, timezone').eq('id', branchId).maybeSingle(),
    supabase
      .from('shifts')
      .select(
        'id, work_date, scheduled_start, scheduled_end, break_minutes, status, checked_in_at, checked_out_at, paid_minutes, employees(id, code, full_name)',
      )
      .eq('branch_id', branchId)
      .gte('work_date', weekStart)
      .lt('work_date', addDays(weekStart, 7))
      .is('deleted_at', null)
      .order('scheduled_start'),
  ]);
  if (error) throw error;
  return { branch, shifts: shifts ?? [] };
}

export async function listSchedulableEmployees() {
  const supabase = await createClient();
  const { data } = await supabase.from('employees').select('id, code, full_name, home_branch_id').eq('status', 'active').order('full_name');
  return data ?? [];
}

export async function getShift(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('shifts')
    .select('*, employees(id, code, full_name), branches(id, name, timezone)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const { data: history } = await supabase
    .from('audit_events')
    .select('id, occurred_at, reason, action, old_data, new_data')
    .eq('table_name', 'shifts')
    .eq('record_id', id)
    .order('occurred_at', { ascending: false })
    .limit(20);
  return { shift: data, history: history ?? [] };
}
