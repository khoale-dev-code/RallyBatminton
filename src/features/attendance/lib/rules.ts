import { z } from 'zod';

import { addDays, dateKeyInZone, zonedToUtc } from '@/lib/time';

/**
 * Quy tắc chấm công phía giao diện — PHẢI khớp với supabase/sql/21_attendance_rules.sql
 * (private.shift_paid_minutes). Database mới là nơi tính công thật; ở đây chỉ để hiển thị / giải thích.
 */

export const attendanceSettingsSchema = z.object({
  late_grace_minutes: z.number(),
  late_out_review_minutes: z.number(),
  fix_request_hours: z.number(),
  forgot_warn_count: z.number(),
  qr_ttl_seconds: z.number(),
  auto_close_forgotten: z.boolean(),
});
export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  late_grace_minutes: 10,
  late_out_review_minutes: 30,
  fix_request_hours: 24,
  forgot_warn_count: 3,
  qr_ttl_seconds: 45,
  auto_close_forgotten: true,
};

const MIN = 60_000;
const ms = (v: string | Date) => (typeof v === 'string' ? new Date(v).getTime() : v.getTime());

export interface ShiftTimes {
  scheduled_start: string;
  scheduled_end: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  actual_time_decision?: string | null;
}

/** Khung được trả công: [bắt đầu, kết thúc] theo quy tắc; null khi chưa đủ giờ vào/ra. */
export function paidWindow(s: ShiftTimes, overtimeMinutes: number): { start: number; end: number; capped: boolean } | null {
  if (!s.checked_in_at || !s.checked_out_at) return null;
  const approved = s.actual_time_decision === 'approved';
  const cap = ms(s.scheduled_end) + Math.max(0, overtimeMinutes) * MIN;
  const start = approved ? ms(s.checked_in_at) : Math.max(ms(s.checked_in_at), ms(s.scheduled_start));
  const end = approved ? ms(s.checked_out_at) : Math.min(ms(s.checked_out_at), cap);
  return { start, end, capped: !approved && (ms(s.checked_out_at) > cap || ms(s.checked_in_at) < ms(s.scheduled_start)) };
}

/** Phút đi trễ (0 nếu trong ân hạn). */
export function lateMinutes(s: Pick<ShiftTimes, 'scheduled_start' | 'checked_in_at'>, graceMinutes: number): number {
  if (!s.checked_in_at) return 0;
  const late = Math.floor((ms(s.checked_in_at) - ms(s.scheduled_start)) / MIN);
  return late > graceMinutes ? late : 0;
}

/** Phút ra ca muộn hơn khung (giờ kết thúc + tăng ca đã đồng ý). */
export function lateOutMinutes(s: Pick<ShiftTimes, 'scheduled_end' | 'checked_out_at'>, overtimeMinutes: number): number {
  if (!s.checked_out_at) return 0;
  return Math.max(0, Math.floor((ms(s.checked_out_at) - ms(s.scheduled_end)) / MIN) - Math.max(0, overtimeMinutes));
}

/** Còn trong hạn gửi yêu cầu sửa giờ (tính từ giờ kết thúc ca). */
export function canRequestFix(s: Pick<ShiftTimes, 'scheduled_start' | 'scheduled_end'>, hours: number, now: number): boolean {
  return now >= ms(s.scheduled_start) - 60 * MIN && now <= ms(s.scheduled_end) + hours * 60 * MIN;
}

/**
 * Giờ "HH:MM" nhân viên khai → thời điểm cụ thể. Ca qua nửa đêm: chọn ngày (ngày làm hoặc hôm sau) cho kết quả
 * gần khung ca nhất.
 */
export function claimToInstant(time: string, s: Pick<ShiftTimes, 'scheduled_start' | 'scheduled_end'>, tz: string): Date | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const day = dateKeyInZone(new Date(s.scheduled_start), tz);
  const lo = ms(s.scheduled_start) - 60 * MIN;
  const hi = ms(s.scheduled_end) + 4 * 60 * MIN;
  const candidates = [addDays(day, -1), day, addDays(day, 1)].map((d) => zonedToUtc(d, time, tz));
  const distance = (t: number) => (t < lo ? lo - t : t > hi ? t - hi : 0);
  return candidates.sort((a, b) => distance(a.getTime()) - distance(b.getTime()))[0] ?? null;
}

export const SOURCE_LABEL: Record<string, string> = {
  qr: 'Quét QR',
  request: 'Theo yêu cầu đã duyệt',
  owner: 'Chủ sân sửa',
  auto: 'Tự đóng (quên ra ca)',
};

export const FIX_STATUS: Record<string, { label: string; tone: 'amber' | 'green' | 'red' | 'neutral' }> = {
  pending: { label: 'Chờ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt', tone: 'green' },
  rejected: { label: 'Bị từ chối', tone: 'red' },
  cancelled: { label: 'Đã rút', tone: 'neutral' },
};
