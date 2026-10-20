'use server';

import { createHash, randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner, requireStaff } from '@/lib/auth/guards';
import { toUserMessage } from '@/lib/errors';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/format';
import { siteOrigin } from '@/lib/site-origin';
import { DEFAULT_TZ } from '@/lib/time';
import { formDataToObject, zCheckbox, zUuid } from '@/lib/validation';

import { claimToInstant } from './lib/rules';

export type IssueQrResult = { ok: true; url: string; expiresAt: string } | { ok: false; error: string };

/**
 * Tạo mã QR chấm công (hiệu lực 90 giây). Token ngẫu nhiên chỉ nằm trong QR;
 * database chỉ lưu SHA-256 nên lộ bảng cũng không giả mạo được mã.
 */
export async function issueQrAction(branchId: string): Promise<IssueQrResult> {
  await requireOwner();
  if (!zUuid().safeParse(branchId).success) return { ok: false, error: 'Chi nhánh không hợp lệ.' };
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('issue_attendance_qr', { p_branch_id: branchId, p_token_hash: hash });
  if (error) return { ok: false, error: toUserMessage(error) };
  const res = z.object({ expires_at: z.string() }).safeParse(data);
  if (!res.success) return { ok: false, error: 'Không tạo được mã QR.' };
  // Tên miền đang mở trang (không phải NEXT_PUBLIC_SITE_URL) → điện thoại nhân viên quét là mở đúng website.
  return { ok: true, url: `${await siteOrigin()}/checkin?t=${token}`, expiresAt: res.data.expires_at };
}

const scanSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/, 'Mã QR không hợp lệ'),
  event: z.enum(['checkin', 'checkout']),
});

export async function scanAttendanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = scanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formError('Mã QR không hợp lệ. Quét lại mã trên màn hình quầy.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('scan_attendance_qr', { p_token: parsed.data.token, p_event: parsed.data.event });
  if (error) return formError(toUserMessage(error));
  revalidatePath('/checkin');
  revalidatePath('/admin/me');
  const res = z.object({ event: z.string(), at: z.string(), paid_minutes: z.number().optional() }).safeParse(data);
  const at = res.success ? formatTime(res.data.at) : '';
  if (parsed.data.event === 'checkin') return formSuccess(`Đã vào ca lúc ${at}. Chúc ca làm suôn sẻ!`);
  const minutes = res.success ? (res.data.paid_minutes ?? 0) : 0;
  return formSuccess(`Đã ra ca lúc ${at}. Công ghi nhận: ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút.`);
}

// ---------------------------------------------------------------------------
// Yêu cầu sửa giờ (nhân viên quên quét), duyệt giờ thực tế, cài đặt, máy quầy
// ---------------------------------------------------------------------------

function revalidateAttendance(shiftId?: string) {
  revalidatePath('/admin/me');
  revalidatePath('/admin/timesheet');
  revalidatePath('/admin/payroll');
  revalidatePath('/admin/shifts');
  revalidatePath('/checkin');
  if (shiftId) revalidatePath(`/admin/shifts/${shiftId}`);
}

const fixSchema = z.object({
  kind: z.enum(['in', 'out'], { error: 'Chọn giờ vào hoặc giờ ra' }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Nhập giờ dạng HH:MM'),
  reason: z.string().trim().min(5, 'Ghi lý do, tối thiểu 5 ký tự').max(300, 'Tối đa 300 ký tự'),
});

/** Nhân viên khai giờ vào / ra thật khi quên quét QR → chờ chủ sân duyệt. */
export async function requestFixAction(shiftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  if (!zUuid().safeParse(shiftId).success) return formError('Ca không hợp lệ.');
  const parsed = fixSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from('shifts')
    .select('scheduled_start, scheduled_end, branches(timezone)')
    .eq('id', shiftId)
    .maybeSingle();
  if (!shift) return formError('Không tìm thấy ca.');
  const claimed = claimToInstant(parsed.data.time, shift, shift.branches?.timezone ?? DEFAULT_TZ);
  if (!claimed) return formError('Giờ không hợp lệ.');
  const { error } = await supabase.rpc('request_attendance_fix', {
    p_shift_id: shiftId,
    p_kind: parsed.data.kind,
    p_claimed_at: claimed.toISOString(),
    p_reason: parsed.data.reason,
  });
  if (error) return formDbError(error);
  revalidateAttendance(shiftId);
  return formSuccess('Đã gửi yêu cầu. Chủ sân duyệt xong, giờ công sẽ tự cập nhật.');
}

export async function cancelFixAction(requestId: string, _prev: FormState): Promise<FormState> {
  await requireStaff();
  if (!zUuid().safeParse(requestId).success) return formError('Yêu cầu không hợp lệ.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_attendance_fix', { p_request_id: requestId });
  if (error) return formDbError(error);
  revalidateAttendance();
  return formSuccess('Đã rút yêu cầu.');
}

/** Chủ sân duyệt / từ chối yêu cầu sửa giờ (từ chối bắt buộc ghi lý do). */
export async function decideFixAction(requestId: string, approve: boolean, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  if (!zUuid().safeParse(requestId).success) return formError('Yêu cầu không hợp lệ.');
  const note = String(formData.get('note') ?? '')
    .trim()
    .slice(0, 300);
  if (!approve && note.length < 3) return formError('Ghi lý do từ chối để nhân viên biết.', { note: 'Tối thiểu 3 ký tự' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_attendance_fix', { p_request_id: requestId, p_approve: approve, p_note: note || null });
  if (error) return formDbError(error);
  revalidateAttendance();
  return formSuccess(approve ? 'Đã duyệt — giờ công đã cập nhật.' : 'Đã từ chối yêu cầu.');
}

/** Chủ sân: trả theo giờ thực tế (nhân viên ở lại làm thật) / giữ theo khung ca / bỏ quyết định. */
export async function decideActualTimeAction(
  shiftId: string,
  decision: 'approved' | 'kept' | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  if (!zUuid().safeParse(shiftId).success) return formError('Ca không hợp lệ.');
  const reason =
    String(formData.get('reason') ?? '').trim() ||
    (decision === 'approved' ? 'Nhân viên ở lại làm thật' : decision === 'kept' ? 'Ra ca trễ, không làm thêm' : 'Xem lại');
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_actual_time', { p_shift_id: shiftId, p_decision: decision, p_reason: reason });
  if (error) return formDbError(error);
  revalidateAttendance(shiftId);
  return formSuccess(
    decision === 'approved' ? 'Đã trả công theo giờ thực tế.' : decision === 'kept' ? 'Đã giữ công theo khung ca.' : 'Đã bỏ quyết định.',
  );
}

const settingsSchema = z.object({
  late_grace_minutes: z.coerce.number().int().min(0, '0–60 phút').max(60, '0–60 phút'),
  late_out_review_minutes: z.coerce.number().int().min(5, '5–240 phút').max(240, '5–240 phút'),
  fix_request_hours: z.coerce.number().int().min(1, '1–168 giờ').max(168, '1–168 giờ'),
  forgot_warn_count: z.coerce.number().int().min(1, '1–31 lần').max(31, '1–31 lần'),
  qr_ttl_seconds: z.coerce.number().int().min(20, '20–180 giây').max(180, '20–180 giây'),
  auto_close_forgotten: zCheckbox(),
});

export async function updateAttendanceSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = settingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_attendance_settings', {
    p_late_grace_minutes: v.late_grace_minutes,
    p_late_out_review_minutes: v.late_out_review_minutes,
    p_fix_request_hours: v.fix_request_hours,
    p_forgot_warn_count: v.forgot_warn_count,
    p_qr_ttl_seconds: v.qr_ttl_seconds,
    p_auto_close_forgotten: v.auto_close_forgotten,
  });
  if (error) return formDbError(error);
  revalidatePath('/admin/settings');
  revalidateAttendance();
  return formSuccess('Đã lưu quy tắc chấm công.');
}

export type KioskCreated = { ok: true; url: string; name: string } | { ok: false; error: string };

/** Tạo máy quầy: khóa thiết bị chỉ hiện MỘT lần (database chỉ lưu mã băm). */
export async function createKioskAction(branchId: string, name: string): Promise<KioskCreated> {
  await requireOwner();
  const cleanName = name.trim().slice(0, 60);
  if (!zUuid().safeParse(branchId).success) return { ok: false, error: 'Chi nhánh không hợp lệ.' };
  if (cleanName.length < 2) return { ok: false, error: 'Đặt tên máy, ví dụ "Máy tính bảng quầy".' };
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_attendance_kiosk', { p_branch_id: branchId, p_name: cleanName, p_token_hash: hash });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath('/admin/attendance');
  return { ok: true, url: `${await siteOrigin()}/kiosk/${token}`, name: cleanName };
}

export async function revokeKioskAction(kioskId: string, _prev: FormState): Promise<FormState> {
  await requireOwner();
  if (!zUuid().safeParse(kioskId).success) return formError('Máy không hợp lệ.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_attendance_kiosk', { p_kiosk_id: kioskId });
  if (error) return formDbError(error);
  revalidatePath('/admin/attendance');
  return formSuccess('Đã thu hồi máy quầy — đường dẫn cũ không còn hiện mã.');
}

export type KioskQrResult = { ok: true; url: string; expiresAt: string; branchName: string } | { ok: false; error: string };

/** Trang /kiosk/<khóa> (không đăng nhập) xin mã QR mới bằng khóa thiết bị. */
export async function kioskIssueQrAction(deviceToken: string): Promise<KioskQrResult> {
  if (!/^[0-9a-f]{48}$/.test(deviceToken)) return { ok: false, error: toUserMessage({ message: 'KIOSK_INVALID' }) };
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const { data, error } = await createPublicClient().rpc('kiosk_issue_qr', { p_device_token: deviceToken, p_token_hash: hash });
  if (error) return { ok: false, error: toUserMessage(error) };
  const res = z.object({ expires_at: z.string(), branch_name: z.string() }).safeParse(data);
  if (!res.success) return { ok: false, error: 'Không tạo được mã QR.' };
  return { ok: true, url: `${await siteOrigin()}/checkin?t=${token}`, expiresAt: res.data.expires_at, branchName: res.data.branch_name };
}
