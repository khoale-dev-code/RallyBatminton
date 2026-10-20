'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner, requireStaff } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { addDays, DEFAULT_TZ } from '@/lib/time';
import { formDataStrings, formDataToObject, zCheckbox, zDateKey, zInt, zMoney, zOptionalText, zText, zTime, zUuid } from '@/lib/validation';

import { buildPlan, MAX_PLAN_DAYS, MAX_PLAN_EMPLOYEES } from './lib/plan';
import { localInputToUtc, shiftWindow } from './lib/shift-time';

async function branchTimezone(branchId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('timezone').eq('id', branchId).maybeSingle();
  return data?.timezone ?? DEFAULT_TZ;
}

const planSchema = z.object({
  branch_id: zUuid('chi nhánh'),
  employee_ids: z
    .array(z.uuid('Nhân viên không hợp lệ'))
    .min(1, 'Chọn ít nhất một nhân viên')
    .max(MAX_PLAN_EMPLOYEES, `Tối đa ${MAX_PLAN_EMPLOYEES} nhân viên mỗi lần`),
  dates: z.array(zDateKey('ngày làm')).min(1, 'Chọn ít nhất một ngày').max(MAX_PLAN_DAYS, `Tối đa ${MAX_PLAN_DAYS} ngày mỗi lần`),
  start: zTime('giờ vào ca'),
  end: zTime('giờ ra ca'),
  break_minutes: zInt('Phút nghỉ', 0, 240),
  note: zOptionalText(300),
});

function shortDate(dateKey: string): string {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

/**
 * Xếp ca hàng loạt: nhiều nhân viên × nhiều ngày cùng khung giờ. Ca trùng giờ với ca đã có của nhân viên
 * được bỏ qua (báo lại), phần còn lại vẫn được xếp. Database vẫn chặn trùng bằng ràng buộc loại trừ.
 */
export async function createShiftsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = planSchema.safeParse({
    ...formDataToObject(formData),
    employee_ids: [...new Set(formDataStrings(formData, 'employee_ids'))],
    dates: [...new Set(formDataStrings(formData, 'dates'))].sort(),
  });
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const tz = await branchTimezone(v.branch_id);
  const supabase = await createClient();

  // Ca hiện có của các nhân viên này quanh khoảng ngày (mọi chi nhánh) để biết ngày nào trùng.
  const first = v.dates[0] ?? '';
  const last = v.dates[v.dates.length - 1] ?? first;
  const { data: existing, error: readError } = await supabase
    .from('shifts')
    .select('employee_id, scheduled_start, scheduled_end')
    .in('employee_id', v.employee_ids)
    .gte('work_date', addDays(first, -1))
    .lte('work_date', addDays(last, 1))
    .is('deleted_at', null)
    .neq('status', 'cancelled');
  if (readError) return formDbError(readError);

  const plan = buildPlan({
    employeeIds: v.employee_ids,
    dates: v.dates,
    start: v.start,
    end: v.end,
    breakMinutes: v.break_minutes,
    tz,
    existing: (existing ?? []).map((e) => ({ employeeId: e.employee_id, start: e.scheduled_start, end: e.scheduled_end })),
  });
  if (plan.error) return formError(plan.error, { end: plan.error });
  const rows = plan.items
    .filter((i) => !i.conflict)
    .map((i) => ({
      employee_id: i.employeeId,
      branch_id: v.branch_id,
      work_date: i.workDate,
      scheduled_start: i.startsAt.toISOString(),
      scheduled_end: i.endsAt.toISOString(),
      break_minutes: v.break_minutes,
      note: v.note ?? null,
    }));
  const skipped = plan.items.filter((i) => i.conflict);
  if (rows.length === 0) {
    return formError(`Tất cả ${skipped.length} ca đều trùng giờ với ca đã có — không xếp thêm.`);
  }
  const { error } = await supabase.from('shifts').insert(rows);
  if (error) return formDbError(error, 'Không xếp được ca (có thể vừa có người xếp trùng giờ). Tải lại trang và thử lại.');
  revalidatePath('/admin/shifts');
  revalidatePath('/admin/me');
  const skippedText =
    skipped.length > 0
      ? ` Bỏ qua ${skipped.length} ca trùng giờ (${[...new Set(skipped.map((i) => shortDate(i.workDate)))].slice(0, 4).join(', ')}${
          skipped.length > 4 ? '…' : ''
        }).`
      : '';
  return formSuccess(`Đã xếp ${rows.length} ca${plan.overnight ? ' (qua nửa đêm)' : ''}.${skippedText}`);
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

const offerSchema = z.object({
  minutes: zInt('Thời gian tăng ca', 15, 480),
  hourly_rate: zMoney('Giá tăng ca', { min: 1000, max: 20_000_000 }),
  reason: zText('lý do tăng ca', 3, 300),
  agreed_in_person: zCheckbox(),
});

/** Chủ sân đề nghị tăng ca ngay sau ca (nhân viên đồng ý qua ứng dụng, hoặc ghi nhận đã đồng ý trực tiếp). */
export async function offerOvertimeAction(shiftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = offerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('offer_overtime', {
    p_shift_id: shiftId,
    p_minutes: v.minutes,
    p_hourly_rate: v.hourly_rate,
    p_reason: v.reason,
    p_agreed_in_person: v.agreed_in_person,
  });
  if (error) return formDbError(error);
  const status = z.object({ status: z.string() }).safeParse(data);
  revalidatePath('/admin/shifts');
  revalidatePath(`/admin/shifts/${shiftId}`);
  revalidatePath('/admin/payroll');
  revalidatePath('/admin/me');
  return formSuccess(
    status.success && status.data.status === 'accepted'
      ? 'Đã ghi nhận tăng ca (nhân viên đồng ý trực tiếp).'
      : 'Đã gửi đề nghị tăng ca — chờ nhân viên đồng ý trong “Ca & lương của tôi”.',
  );
}

const cancelOvertimeSchema = z.object({ reason: zText('lý do hủy', 3, 300) });

export async function cancelOvertimeAction(offerId: string, shiftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = cancelOvertimeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_overtime', { p_offer_id: offerId, p_reason: parsed.data.reason });
  if (error) return formDbError(error);
  revalidatePath('/admin/shifts');
  revalidatePath(`/admin/shifts/${shiftId}`);
  revalidatePath('/admin/payroll');
  revalidatePath('/admin/me');
  return formSuccess('Đã hủy tăng ca.');
}

const respondSchema = z.object({ decision: z.enum(['accept', 'decline']), note: zOptionalText(300) });

/** Nhân viên trả lời đề nghị tăng ca của chính mình (database kiểm tra đúng người, còn hạn). */
export async function respondOvertimeAction(offerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = respondSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error, 'Chọn Đồng ý hoặc Từ chối.');
  const supabase = await createClient();
  const accept = parsed.data.decision === 'accept';
  const { error } = await supabase.rpc('respond_overtime', { p_offer_id: offerId, p_accept: accept, p_note: parsed.data.note ?? null });
  if (error) return formDbError(error);
  revalidatePath('/admin/me');
  revalidatePath('/admin/shifts');
  return formSuccess(accept ? 'Bạn đã đồng ý tăng ca. Nhớ quét QR ra ca khi về.' : 'Bạn đã từ chối tăng ca.');
}
