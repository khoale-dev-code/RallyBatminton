import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { attendanceSettingsSchema, DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from './lib/rules';

/** Ca của chính nhân viên quanh thời điểm hiện tại (RLS chỉ trả ca của mình). */
export async function getMyCurrentShifts(employeeId: string, nowIso: string) {
  const supabase = await createClient();
  const now = new Date(nowIso).getTime();
  const from = new Date(now - 4 * 3600_000).toISOString();
  const to = new Date(now + 24 * 3600_000).toISOString();
  const base = 'id, scheduled_start, scheduled_end, status, checked_in_at, checked_out_at, paid_minutes, branches(name, timezone)';
  const { data, error } = await supabase
    .from('shifts')
    .select(`${base}, attendance_fix_requests(id, kind, status)`)
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .gte('scheduled_end', from)
    .lte('scheduled_start', to)
    .order('scheduled_start');
  let shifts = data ?? [];
  if (error) {
    // Chưa chạy 21_attendance_rules.sql: vẫn cho chấm công (không có phần yêu cầu sửa giờ).
    console.error('[attendance] Không đọc được yêu cầu sửa giờ (đã chạy 21_attendance_rules.sql?):', error.message);
    const { data: plain } = await supabase
      .from('shifts')
      .select(base)
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .gte('scheduled_end', from)
      .lte('scheduled_start', to)
      .order('scheduled_start');
    shifts = (plain ?? []).map((s) => ({ ...s, attendance_fix_requests: [] }));
  }
  return {
    open: shifts.find((s) => s.checked_in_at && !s.checked_out_at) ?? null,
    next: shifts.find((s) => s.status === 'scheduled' && !s.checked_in_at) ?? null,
    // Vừa ra ca (≤ 5 phút): trang hiện kết quả thay vì nhắc "đây là mã RA CA".
    justOut: shifts.find((s) => s.checked_out_at && now - new Date(s.checked_out_at).getTime() < 5 * 60_000) ?? null,
  };
}

/** Quy tắc chấm công (một dòng). Chưa chạy SQL 21 → mặc định. */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from('attendance_settings').select('*').maybeSingle();
  const parsed = attendanceSettingsSchema.safeParse(data);
  return parsed.success ? parsed.data : DEFAULT_ATTENDANCE_SETTINGS;
}

const when = z.string();
const reviewSchema = z.object({
  settings: attendanceSettingsSchema,
  fixes: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['in', 'out']),
      claimed_at: when,
      recorded_at: when.nullable(),
      reason: z.string(),
      created_at: when,
      shift_id: z.string(),
      scheduled_start: when,
      scheduled_end: when,
      scanned_in_at: when.nullable(),
      scanned_out_at: when.nullable(),
      employee_id: z.string(),
      employee_name: z.string(),
      employee_code: z.string(),
      branch_name: z.string(),
      timezone: z.string(),
      month_fixes: z.number(),
    }),
  ),
  late_outs: z.array(
    z.object({
      shift_id: z.string(),
      scheduled_start: when,
      scheduled_end: when,
      checked_in_at: when,
      checked_out_at: when,
      paid_minutes: z.number(),
      overtime_minutes: z.number(),
      employee_name: z.string(),
      employee_code: z.string(),
      branch_name: z.string(),
      timezone: z.string(),
    }),
  ),
  auto_closed: z.array(
    z.object({
      shift_id: z.string(),
      scheduled_start: when,
      scheduled_end: when,
      checked_in_at: when,
      checked_out_at: when,
      employee_name: z.string(),
      employee_code: z.string(),
      branch_name: z.string(),
      timezone: z.string(),
    }),
  ),
  frequent: z.array(z.object({ employee_id: z.string(), employee_name: z.string(), employee_code: z.string(), count: z.number() })),
});
export type ReviewQueue = z.infer<typeof reviewSchema>;

/** Việc cần chủ sân xử lý: yêu cầu sửa giờ, ca ra trễ, ca tự đóng, người hay quên. Tự đóng ca quên ra trước khi đọc. */
export async function getReviewQueue(): Promise<ReviewQueue | null> {
  const supabase = await createClient();
  await supabase.rpc('close_forgotten_shifts');
  const { data, error } = await supabase.rpc('attendance_review_queue');
  if (error) {
    console.error('[attendance] Không đọc được hàng đợi duyệt (đã chạy 21_attendance_rules.sql?):', error.message);
    return null;
  }
  const parsed = reviewSchema.safeParse(data);
  if (!parsed.success) console.error('[attendance] review queue parse', parsed.error.issues.slice(0, 3));
  return parsed.success ? parsed.data : null;
}

/** Số việc chờ duyệt (huy hiệu menu của chủ sân). Lỗi / chưa chạy SQL 21 → 0. */
export async function getReviewCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('attendance_review_counts');
  if (error) return 0;
  const parsed = z.object({ pending_fixes: z.number(), late_outs: z.number() }).safeParse(data);
  return parsed.success ? parsed.data.pending_fixes + parsed.data.late_outs : 0;
}

export async function listKiosks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('attendance_kiosks')
    .select('id, branch_id, name, created_at, last_seen_at, revoked_at, branches(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}
