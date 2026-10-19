'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { addDays, DEFAULT_TZ } from '@/lib/time';
import { formDataToObject, zDateKey, zInt, zOptionalText, zText, zTime, zUuid } from '@/lib/validation';

import { localInputToUtc, shiftWindow } from './lib/shift-time';

const shiftSchema = z.object({
  employee_id: zUuid('nhân viên'),
  branch_id: zUuid('chi nhánh'),
  work_date: zDateKey('ngày làm'),
  start: zTime('giờ vào ca'),
  end: zTime('giờ ra ca'),
  break_minutes: zInt('Phút nghỉ', 0, 240),
  note: zOptionalText(300),
  repeat_days: zInt('Số ngày lặp', 1, 14),
});

async function branchTimezone(branchId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('timezone').eq('id', branchId).maybeSingle();
  return data?.timezone ?? DEFAULT_TZ;
}

/** Xếp ca (có thể lặp nhiều ngày liên tiếp). Ca qua nửa đêm: giờ ra ≤ giờ vào. */
export async function createShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = shiftSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const tz = await branchTimezone(v.branch_id);
  const first = shiftWindow(v.work_date, v.start, v.end, tz);
  if (first.minutes > 16 * 60) return formError('Ca tối đa 16 giờ.', { end: 'Ca tối đa 16 giờ' });
  if (v.break_minutes >= first.minutes) return formError('Giờ nghỉ phải ngắn hơn ca.', { break_minutes: 'Giờ nghỉ quá dài' });

  const rows = Array.from({ length: v.repeat_days }, (_, i) => {
    const dateKey = addDays(v.work_date, i);
    const w = shiftWindow(dateKey, v.start, v.end, tz);
    return {
      employee_id: v.employee_id,
      branch_id: v.branch_id,
      work_date: dateKey,
      scheduled_start: w.startsAt.toISOString(),
      scheduled_end: w.endsAt.toISOString(),
      break_minutes: v.break_minutes,
      note: v.note ?? null,
    };
  });
  const supabase = await createClient();
  const { error } = await supabase.from('shifts').insert(rows);
  if (error) return formDbError(error);
  revalidatePath('/admin/shifts');
  return formSuccess(rows.length > 1 ? `Đã xếp ${rows.length} ca.` : `Đã xếp ca${first.overnight ? ' (qua nửa đêm)' : ''}.`);
}

const rescheduleSchema = z.object({
  work_date: zDateKey('ngày làm'),
  start: zTime('giờ vào ca'),
  end: zTime('giờ ra ca'),
  break_minutes: zInt('Phút nghỉ', 0, 240),
  note: zOptionalText(300),
});

export async function rescheduleShiftAction(shiftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = rescheduleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: shift } = await supabase.from('shifts').select('branch_id').eq('id', shiftId).maybeSingle();
  if (!shift) return formError('Không tìm thấy ca.');
  const w = shiftWindow(v.work_date, v.start, v.end, await branchTimezone(shift.branch_id));
  const { error } = await supabase
    .from('shifts')
    .update({
      scheduled_start: w.startsAt.toISOString(),
      scheduled_end: w.endsAt.toISOString(),
      break_minutes: v.break_minutes,
      note: v.note ?? null,
    })
    .eq('id', shiftId);
  if (error) return formDbError(error);
  revalidatePath('/admin/shifts');
  revalidatePath(`/admin/shifts/${shiftId}`);
  return formSuccess('Đã đổi lịch ca.');
}

const adjustSchema = z.object({
  status: z.enum(['present', 'absent', 'leave', 'cancelled'], { error: 'Chọn trạng thái' }),
  checked_in_at: z.string().optional(),
  checked_out_at: z.string().optional(),
  actual_break_minutes: z.preprocess((v) => (v === '' ? undefined : v), zInt('Phút nghỉ', 0, 240).optional()),
  reason: zText('lý do điều chỉnh', 5, 300),
});

/** Sửa công chỉ qua RPC owner_adjust_attendance: bắt buộc lý do, lưu nhật ký trước/sau. */
export async function adjustAttendanceAction(shiftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = adjustSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: shift } = await supabase.from('shifts').select('branch_id').eq('id', shiftId).maybeSingle();
  if (!shift) return formError('Không tìm thấy ca.');
  const tz = await branchTimezone(shift.branch_id);
  const inAt = v.checked_in_at ? localInputToUtc(v.checked_in_at, tz) : null;
  const outAt = v.checked_out_at ? localInputToUtc(v.checked_out_at, tz) : null;
  if (v.status === 'present' && inAt && outAt && outAt <= inAt) {
    return formError('Giờ ra phải sau giờ vào.', { checked_out_at: 'Giờ ra phải sau giờ vào' });
  }
  const { error } = await supabase.rpc('owner_adjust_attendance', {
    p_shift_id: shiftId,
    p_status: v.status,
    p_reason: v.reason,
    p_checked_in_at: inAt?.toISOString(),
    p_checked_out_at: outAt?.toISOString(),
    p_actual_break_minutes: v.actual_break_minutes,
  });
  if (error) return formDbError(error);
  revalidatePath('/admin/shifts');
  revalidatePath(`/admin/shifts/${shiftId}`);
  revalidatePath('/admin/payroll');
  return formSuccess('Đã điều chỉnh công và ghi nhật ký.');
}
