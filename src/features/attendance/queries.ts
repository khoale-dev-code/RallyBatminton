import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Ca của chính nhân viên quanh thời điểm hiện tại (RLS chỉ trả ca của mình). */
export async function getMyCurrentShifts(employeeId: string, nowIso: string) {
  const supabase = await createClient();
  const now = new Date(nowIso).getTime();
  const { data } = await supabase
    .from('shifts')
    .select('id, scheduled_start, scheduled_end, status, checked_in_at, checked_out_at, branches(name, timezone)')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .gte('scheduled_end', new Date(now - 4 * 3600_000).toISOString())
    .lte('scheduled_start', new Date(now + 24 * 3600_000).toISOString())
    .order('scheduled_start');
  const shifts = data ?? [];
  return {
    open: shifts.find((s) => s.checked_in_at && !s.checked_out_at) ?? null,
    next: shifts.find((s) => s.status === 'scheduled' && !s.checked_in_at) ?? null,
  };
}
