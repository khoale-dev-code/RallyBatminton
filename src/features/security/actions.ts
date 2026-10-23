'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getStaffContext } from '@/lib/auth/context';
import { clearStaffContextCache } from '@/lib/auth/context-cache';
import { toUserMessage } from '@/lib/errors';
import { formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { invalidatePublic } from '@/lib/public-cache';
import { createSecretClient } from '@/lib/supabase/secret';
import { createClient } from '@/lib/supabase/server';
import { zUuid } from '@/lib/validation';

import { LIMIT_FIELDS, limitsSchema, lockMessage, pauseSchema, totpCodeSchema } from './lib/settings';
import { loginLockSeconds, recordLoginResult } from './login-guard';

const SECURITY_PATH = '/admin/security';

/** Ghi sự kiện "thay đổi 2 lớp" (nhật ký cho chủ sân). Lỗi không chặn thao tác chính. */
async function noteMfaChange(severity: 'info' | 'warning', subject: string, userId: string): Promise<void> {
  try {
    await createSecretClient().rpc('service_record_security_event', {
      p_kind: 'mfa_change',
      p_severity: severity,
      p_subject: subject.slice(0, 120),
      p_subject_key: `mfa:${userId}:${Date.now()}`,
    });
  } catch {
    // Nhật ký là phụ; thiếu khóa máy chủ thì bỏ qua.
  }
}

// ---- Cài đặt (chủ sân; database kiểm tra quyền + MFA) -------------------------------------------

export async function updateSecurityLimitsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = limitsSchema.safeParse(Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, formData.get(f.key)])));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_security_settings', { p: parsed.data });
  if (error) return formError(toUserMessage(error));
  revalidatePath(SECURITY_PATH);
  return formSuccess('Đã lưu ngưỡng chống lạm dụng.');
}

export async function setOnlineBookingPauseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = pauseSchema.safeParse({ paused: formData.get('paused'), message: formData.get('message') ?? undefined });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_security_settings', {
    p: { online_booking_paused: parsed.data.paused === 'on', pause_message: parsed.data.message },
  });
  if (error) return formError(toUserMessage(error));
  invalidatePublic('booking');
  revalidatePath(SECURITY_PATH);
  return formSuccess(parsed.data.paused === 'on' ? 'Đã tạm dừng đặt sân online.' : 'Đã mở lại đặt sân online.');
}

export async function updateMfaPolicyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_security_settings', {
    p: {
      require_owner_mfa: formData.get('require_owner_mfa') === 'on',
      require_staff_mfa: formData.get('require_staff_mfa') === 'on',
    },
  });
  if (error) return formError(toUserMessage(error));
  clearStaffContextCache();
  revalidatePath('/admin', 'layout');
  return formSuccess('Đã lưu chính sách xác thực 2 lớp.');
}

const eventIdSchema = z.object({ id: zUuid('sự kiện') });

export async function acknowledgeSecurityEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('acknowledge_security_event', { p_event_id: parsed.data.id });
  if (error) return formError(toUserMessage(error));
  revalidatePath('/admin', 'layout');
  return formSuccess('Đã đánh dấu đã xem.');
}

export async function acknowledgeAllSecurityEventsAction(): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('acknowledge_all_security_events');
  if (error) return formError(toUserMessage(error));
  revalidatePath('/admin', 'layout');
  return formSuccess(data ? `Đã đánh dấu ${data} sự kiện.` : 'Không còn sự kiện nào chưa xem.');
}

// ---- Chế độ giữ sân của khách (nhân viên có quyền thao tác đặt sân) ---------------------------------

const holdPolicySchema = z
  .object({
    customerId: zUuid('khách'),
    policy: z.enum(['auto', 'trusted', 'blocked']),
    note: z.string().trim().max(300, 'Tối đa 300 ký tự').optional(),
    days: z.enum(['', '1', '7', '30', '90']).optional(),
  })
  .refine((v) => v.policy === 'auto' || (v.note?.length ?? 0) >= 3, { message: 'Ghi lý do (ít nhất 3 ký tự)', path: ['note'] });

export async function setHoldPolicyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = holdPolicySchema.safeParse({
    customerId: formData.get('customerId'),
    policy: formData.get('policy'),
    note: formData.get('note') ?? undefined,
    days: formData.get('days') ?? undefined,
  });
  if (!parsed.success) return formZodError(parsed.error);
  const { customerId, policy, note, days } = parsed.data;
  const until = days ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_customer_hold_policy', {
    p_customer_id: customerId,
    p_policy: policy,
    p_note: note ?? null,
    p_until: until,
  });
  if (error) return formError(toUserMessage(error));
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath(SECURITY_PATH);
  return formSuccess(
    policy === 'auto' ? 'Đã trả về chế độ tự động.' : policy === 'trusted' ? 'Đã đánh dấu khách tin cậy.' : 'Đã tạm chặn giữ sân online.',
  );
}

// ---- Xác thực 2 lớp (TOTP) --------------------------------------------------------------------------

export type EnrollResult = { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; error: string };

/** Bắt đầu cài ứng dụng xác thực: tạo mã QR. Mã chỉ có hiệu lực sau khi nhập đúng 6 số lần đầu. */
export async function startMfaEnrollAction(): Promise<EnrollResult> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' };
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: 'Không đọc được trạng thái xác thực 2 lớp. Vui lòng thử lại.' };
  // Lần cài trước bỏ dở (chưa nhập mã) → xóa để tạo lại.
  for (const factor of factors.all) {
    if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Rally Badminton',
    friendlyName: `Rally ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  });
  if (error || !data) {
    return {
      ok: false,
      error: /aal2/i.test(error?.message ?? '')
        ? 'Hãy nhập mã 2 lớp hiện tại trước khi thêm thiết bị mới.'
        : 'Không tạo được mã QR. Kiểm tra Supabase đã bật MFA (App Authenticator) rồi thử lại.',
    };
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

const verifySchema = z.object({
  factorId: zUuid('mã thiết bị'),
  code: totpCodeSchema,
  mode: z.enum(['enroll', 'challenge']),
});

/** Nhập mã 6 số: lần đầu (kích hoạt) hoặc mỗi lần đăng nhập. Đúng → phiên lên mức aal2. */
export async function verifyMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = verifySchema.safeParse({
    factorId: formData.get('factorId'),
    code: formData.get('code'),
    mode: formData.get('mode'),
  });
  if (!parsed.success) return formZodError(parsed.error, 'Mã chưa đúng định dạng.');
  const { factorId, code, mode } = parsed.data;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === 'string' ? claims.claims.sub : null;
  if (!userId) redirect('/admin-login');

  // Đoán mã 6 số cũng bị khóa như đoán mật khẩu.
  const guardKey = `mfa:${userId}`;
  const lockSeconds = await loginLockSeconds('staff', guardKey);
  if (lockSeconds > 0) return formError(lockMessage(lockSeconds));

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return formError('Không tạo được lượt xác thực. Tải lại trang rồi thử lại.');
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) {
    await recordLoginResult('staff', guardKey, false);
    return formError('Mã không đúng hoặc đã hết hạn. Nhập mã mới nhất trong ứng dụng.', { code: 'Mã không đúng' });
  }
  await recordLoginResult('staff', guardKey, true);
  clearStaffContextCache();
  if (mode === 'enroll') {
    const ctx = await getStaffContext();
    await noteMfaChange('info', `${ctx?.displayName ?? 'Tài khoản'} đã bật xác thực 2 lớp`, userId);
  }
  // Trình duyệt tự tải lại trang đích (để mọi yêu cầu sau dùng phiên 2 lớp mới) — xem CodeForm.
  return formSuccess(mode === 'enroll' ? 'Đã bật xác thực 2 lớp.' : 'Đã xác thực.');
}

/** Gỡ ứng dụng xác thực của chính mình (cần phiên 2 lớp; không gỡ được khi chủ sân đang bắt buộc). */
export async function removeMyMfaAction(): Promise<FormState> {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin-login');
  if (ctx.mfaRequired) {
    return formError('Chủ sân đang bắt buộc xác thực 2 lớp. Muốn đổi điện thoại: thêm thiết bị mới trước, hoặc nhờ chủ sân đặt lại.');
  }
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') return formError('Hãy đăng nhập lại và nhập mã 2 lớp trước khi gỡ.');
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return formError('Không đọc được thiết bị xác thực. Vui lòng thử lại.');
  for (const factor of factors.all) {
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removeError) return formError('Không gỡ được. Vui lòng đăng nhập lại rồi thử lại.');
  }
  await supabase.auth.refreshSession();
  clearStaffContextCache();
  await noteMfaChange('warning', `${ctx.displayName} đã GỠ xác thực 2 lớp`, ctx.userId);
  revalidatePath(SECURITY_PATH);
  return formSuccess('Đã gỡ xác thực 2 lớp.');
}

const resetSchema = z.object({ userId: zUuid('tài khoản') });

/**
 * Chủ sân đặt lại 2 lớp cho nhân viên mất điện thoại. Cần chủ sân đang ở phiên 2 lớp.
 * Quyền chủ sân xác minh ở database (bảng cài đặt bảo mật chỉ chủ sân đọc được) trước khi dùng khóa máy chủ.
 */
export async function resetStaffMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ userId: formData.get('userId') });
  if (!parsed.success) return formZodError(parsed.error);
  const ctx = await getStaffContext();
  if (!ctx || ctx.role !== 'owner') return formError('Chỉ chủ sân được đặt lại xác thực 2 lớp.');
  if (parsed.data.userId === ctx.userId) return formError('Dùng mục “Xác thực 2 lớp của bạn” để đổi thiết bị của chính mình.');
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') return formError('Bạn cần bật và đăng nhập bằng xác thực 2 lớp trước khi đặt lại cho người khác.');
  const { data: proof, error: proofError } = await supabase.from('security_settings').select('id').eq('id', true).maybeSingle();
  if (proofError || !proof) return formError('Chỉ chủ sân được đặt lại xác thực 2 lớp.');
  const { data: target } = await supabase.from('staff_accounts').select('display_name').eq('user_id', parsed.data.userId).maybeSingle();
  if (!target) return formError('Không tìm thấy tài khoản quản trị này.');

  const admin = createSecretClient();
  const { data: factors, error } = await admin.auth.admin.mfa.listFactors({ userId: parsed.data.userId });
  if (error) return formError('Không đọc được thiết bị xác thực của tài khoản này.');
  for (const factor of factors.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: parsed.data.userId });
    if (deleteError) return formError('Không đặt lại được. Vui lòng thử lại.');
  }
  await noteMfaChange('warning', `${ctx.displayName} đặt lại 2 lớp cho ${target.display_name}`, parsed.data.userId);
  revalidatePath(SECURITY_PATH);
  return formSuccess(`Đã đặt lại. ${target.display_name} sẽ cài lại ứng dụng xác thực ở lần đăng nhập tới.`);
}
