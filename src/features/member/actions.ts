'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { verifyTurnstile } from '@/features/booking/turnstile';
import { CONSENT_TEXT } from '@/features/privacy/consent-text';
import { recordAccountConsents } from '@/features/privacy/record-consent';
import { lockMessage } from '@/features/security/lib/settings';
import { loginLockSeconds, recordLoginResult } from '@/features/security/login-guard';
import { siteOrigin } from '@/lib/site-origin';
import { errorCode, toUserMessage } from '@/lib/errors';
import { formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { zCheckbox, zOptionalVnPhone, zText, zVnPhone } from '@/lib/validation';

import { oauthProviderStatus } from './lib/auth-providers';
import { newPasswordSchema } from './lib/password';
import { getMemberProfile } from './queries';
import { isMemberAliasEmail, memberAliasEmail, memberBookingSchema, safeMemberNext, type MemberBooking } from './schemas';

const GENERIC_LOGIN_ERROR = 'Số điện thoại/email hoặc mật khẩu không đúng.';
const GOOGLE_DISABLED = 'Đăng nhập bằng Google đang tạm chưa mở. Bạn vui lòng đăng nhập hoặc đăng ký bằng số điện thoại / email nhé.';
const NO_SECRET = 'Máy chủ chưa cấu hình SUPABASE_SECRET_KEY nên chưa đăng ký / đăng nhập bằng số điện thoại được.';

function secretOrNull() {
  try {
    return createSecretClient();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Đăng ký
// ---------------------------------------------------------------------------
const registerSchema = z
  .discriminatedUnion('method', [
    z.object({
      method: z.literal('phone'),
      full_name: zText('họ tên', 2, 80),
      phone: zVnPhone(),
      password: newPasswordSchema,
      confirm: z.string(),
      next: z.string().optional(),
      turnstileToken: z.string().optional(),
      terms: zCheckbox().refine((v) => v, 'Vui lòng đánh dấu ô xác nhận để tạo tài khoản.'),
      marketing: zCheckbox(),
    }),
    z.object({
      method: z.literal('email'),
      full_name: zText('họ tên', 2, 80),
      email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('Email không hợp lệ').max(160)),
      phone: zOptionalVnPhone(),
      password: newPasswordSchema,
      confirm: z.string(),
      next: z.string().optional(),
      turnstileToken: z.string().optional(),
      terms: zCheckbox().refine((v) => v, 'Vui lòng đánh dấu ô xác nhận để tạo tài khoản.'),
      marketing: zCheckbox(),
    }),
  ])
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập mật khẩu không khớp', path: ['confirm'] });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;

  if (!(await verifyTurnstile(v.turnstileToken ?? '', 'member_auth'))) {
    return formError('Xác minh chống spam không thành công. Vui lòng thử lại.', { turnstileToken: 'Hãy xác minh lại' });
  }
  const secret = secretOrNull();
  if (!secret) return formError(NO_SECRET);

  if (v.phone) {
    const { data: taken } = await secret.rpc('service_member_phone_taken', { p_phone: v.phone });
    if (taken)
      return formError('Số điện thoại đã có tài khoản.', { phone: 'Số này đã có tài khoản — hãy đăng nhập hoặc lấy lại mật khẩu.' });
  }

  const supabase = await createClient();
  const next = safeMemberNext(v.next, '/account?welcome=1');

  if (v.method === 'phone') {
    const email = memberAliasEmail(v.phone);
    const { data: created, error } = await secret.auth.admin.createUser({
      email,
      password: v.password,
      email_confirm: true,
      user_metadata: { full_name: v.full_name, account: 'member' },
    });
    if (error || !created.user) {
      return /already|exists|registered/i.test(error?.message ?? '')
        ? formError('Số điện thoại đã có tài khoản.', { phone: 'Số này đã có tài khoản — hãy đăng nhập.' })
        : formError('Chưa tạo được tài khoản. Vui lòng thử lại.');
    }
    const { error: profileError } = await secret.rpc('service_register_member', {
      p_user_id: created.user.id,
      p_full_name: v.full_name,
      p_phone: v.phone,
      p_login_kind: 'phone',
    });
    if (profileError) {
      await secret.auth.admin.deleteUser(created.user.id);
      return formError(toUserMessage(profileError));
    }
    await recordAccountConsents(created.user.id, v.marketing, CONSENT_TEXT.accountTerms);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: v.password });
    if (signInError) return formSuccess('Đã tạo tài khoản. Vui lòng đăng nhập.');
    redirect(next);
  }

  // Đăng ký bằng email: Supabase gửi thư kích hoạt (nếu dự án bật xác nhận email).
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: v.full_name, account: 'member' },
    },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return formError('Email đã có tài khoản.', { email: 'Email này đã có tài khoản — hãy đăng nhập hoặc lấy lại mật khẩu.' });
    }
    if (error.status === 429) return formError('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.');
    return formError('Chưa tạo được tài khoản. Vui lòng thử lại.');
  }
  // Email đã tồn tại: Supabase trả user "giả" không có identity.
  if (!data.user || (data.user.identities?.length ?? 0) === 0) {
    return formError('Email đã có tài khoản.', { email: 'Email này đã có tài khoản — hãy đăng nhập hoặc lấy lại mật khẩu.' });
  }
  const { error: profileError } = await secret.rpc('service_register_member', {
    p_user_id: data.user.id,
    p_full_name: v.full_name,
    p_phone: v.phone ?? null,
    p_login_kind: 'email',
  });
  if (profileError) {
    await secret.auth.admin.deleteUser(data.user.id);
    return formError(toUserMessage(profileError));
  }
  await recordAccountConsents(data.user.id, v.marketing, CONSENT_TEXT.accountTerms);
  if (data.session) redirect(next);
  return formSuccess(`Đã gửi thư kích hoạt tới ${v.email}. Mở thư và bấm liên kết để hoàn tất đăng ký.`);
}

// ---------------------------------------------------------------------------
// Đăng nhập / đăng xuất
// ---------------------------------------------------------------------------
const signInSchema = z.object({
  login: zText('số điện thoại hoặc email', 3, 160),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
  next: z.string().optional(),
});

export async function memberSignInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const { login, password, next } = parsed.data;

  // Chống dò mật khẩu: sai nhiều lần → khóa tạm (23_security_hardening.sql).
  const lockSeconds = await loginLockSeconds('member', login);
  if (lockSeconds > 0) return formError(lockMessage(lockSeconds));

  let email = login.toLowerCase();
  if (!login.includes('@')) {
    const secret = secretOrNull();
    if (!secret) return formError(NO_SECRET);
    const { data, error } = await secret.rpc('resolve_member_login', { p_login: login });
    if (error || !data) {
      await recordLoginResult('member', login, false);
      return formError(GENERIC_LOGIN_ERROR);
    }
    email = data;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return formError('Email chưa được kích hoạt. Mở thư kích hoạt trong hộp thư (kể cả mục Spam) rồi thử lại.');
    }
    await recordLoginResult('member', login, false);
    return formError(GENERIC_LOGIN_ERROR);
  }
  await recordLoginResult('member', login, true);
  // Tạo hồ sơ nếu thiếu; tài khoản nhân sự / bị khóa không dùng trang khách.
  const { data: profile, error: profileError } = await supabase.rpc('ensure_member_profile');
  if (profileError) {
    await supabase.auth.signOut({ scope: 'local' });
    const code = errorCode(profileError);
    return formError(code === 'STAFF_ACCOUNT' || code === 'MEMBER_LOCKED' ? toUserMessage(profileError) : GENERIC_LOGIN_ERROR);
  }
  const mustChange =
    typeof profile === 'object' && profile !== null && 'must_change_password' in profile && profile.must_change_password === true;
  redirect(mustChange ? '/account/profile?doi-mat-khau=1' : safeMemberNext(next));
}

export async function googleSignInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeMemberNext(typeof formData.get('next') === 'string' ? String(formData.get('next')) : undefined);
  // Kiểm tra trước: Google chưa bật trong Supabase thì báo ngay trên trang, không chuyển sang trang lỗi.
  if ((await oauthProviderStatus('google')) === 'disabled') return formError(GOOGLE_DISABLED);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return formError(GOOGLE_DISABLED);
  redirect(data.url);
}

export async function memberSignOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

// ---------------------------------------------------------------------------
// Quên / đặt lại mật khẩu
// ---------------------------------------------------------------------------
const FORGOT_DONE =
  'Nếu tài khoản có email, chúng tôi đã gửi liên kết đặt lại mật khẩu (hiệu lực 1 giờ). ' +
  'Tài khoản chỉ đăng ký bằng số điện thoại: vui lòng gọi hotline hoặc đến quầy để được cấp mật khẩu tạm.';

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ login: zText('số điện thoại hoặc email', 3, 160) }).safeParse({ login: formData.get('login') });
  if (!parsed.success) return formZodError(parsed.error);
  const secret = secretOrNull();
  if (!secret) return formError(NO_SECRET);
  const { data: email } = await secret.rpc('resolve_member_login', { p_login: parsed.data.login });
  // Không tiết lộ tài khoản có tồn tại hay không; chỉ gửi thư cho tài khoản khách có email thật.
  if (email && !isMemberAliasEmail(email)) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    });
  }
  return formSuccess(FORGOT_DONE);
}

const resetSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập mật khẩu không khớp', path: ['confirm'] });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const profile = await getMemberProfile();
  if (!profile) return formError('Liên kết đặt lại đã hết hạn hoặc đã dùng. Vui lòng yêu cầu liên kết mới.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return formError(
      /different/i.test(error.message)
        ? 'Mật khẩu mới phải khác mật khẩu cũ.'
        : 'Không đặt lại được mật khẩu. Vui lòng yêu cầu liên kết mới.',
    );
  }
  await secretOrNull()?.rpc('service_set_member_password_flag', { p_user_id: profile.user_id, p_must_change: false });
  redirect('/account?password=updated');
}

// ---------------------------------------------------------------------------
// Hồ sơ & bảo mật
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  full_name: zText('họ tên', 2, 80),
  phone: zOptionalVnPhone(),
  marketing_opt_in: zCheckbox(),
});

export async function updateMemberProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_my_member_profile', {
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone ?? null,
    p_marketing_opt_in: parsed.data.marketing_opt_in,
  });
  if (error) {
    const message = toUserMessage(error);
    return errorCode(error) === 'MEMBER_PHONE_TAKEN' ? formError(message, { phone: message }) : formError(message);
  }
  revalidatePath('/account', 'layout');
  return formSuccess('Đã lưu hồ sơ.');
}

const changePasswordSchema = z
  .object({ current: z.string().max(200).optional(), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập mật khẩu không khớp', path: ['confirm'] });

export async function changeMemberPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const profile = await getMemberProfile();
  if (!profile) redirect('/login?next=/account/profile');
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const authEmail = userData.user?.email;
  if (!authEmail) return formError('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');

  // Tài khoản đã có mật khẩu: xác nhận mật khẩu hiện tại trước khi đổi.
  if (profile.has_password) {
    if (!parsed.data.current) return formError('Vui lòng nhập mật khẩu hiện tại.', { current: 'Vui lòng nhập mật khẩu hiện tại' });
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: parsed.data.current });
    if (error) return formError('Mật khẩu hiện tại không đúng.', { current: 'Mật khẩu hiện tại không đúng' });
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return formError(
      /different/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : 'Không đổi được mật khẩu. Vui lòng thử lại.',
    );
  }
  await secretOrNull()?.rpc('service_set_member_password_flag', { p_user_id: profile.user_id, p_must_change: false });
  revalidatePath('/account', 'layout');
  return formSuccess(profile.has_password ? 'Đã đổi mật khẩu.' : 'Đã tạo mật khẩu. Từ nay bạn có thể đăng nhập bằng email và mật khẩu.');
}

// ---------------------------------------------------------------------------
// Đơn đặt sân của thành viên
// ---------------------------------------------------------------------------
const claimSchema = z.object({
  code: zText('mã đơn', 6, 20).transform((c) => c.toUpperCase().replace(/\s/g, '')),
  phone: zVnPhone(),
});

export async function claimBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = claimSchema.safeParse({ code: formData.get('code'), phone: formData.get('phone') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('member_claim_booking', { p_code: parsed.data.code, p_phone: parsed.data.phone });
  if (error) return formError(toUserMessage(error));
  revalidatePath('/account', 'layout');
  const already = typeof data === 'object' && data !== null && 'already_claimed' in data && data.already_claimed === true;
  return formSuccess(already ? `Đơn ${parsed.data.code} đã có trong tài khoản.` : `Đã thêm đơn ${parsed.data.code} vào tài khoản.`);
}

export interface MemberCancelState extends FormState {
  booking?: MemberBooking;
}

export async function memberCancelBookingAction(_prev: MemberCancelState, formData: FormData): Promise<MemberCancelState> {
  const parsed = z.object({ code: zText('mã đơn', 6, 20) }).safeParse({ code: formData.get('code') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('member_cancel_booking', { p_code: parsed.data.code });
  if (error) return formError(toUserMessage(error));
  const booking = memberBookingSchema.safeParse(data);
  revalidatePath('/account', 'layout');
  return { ...formSuccess('Đã hủy đơn.'), booking: booking.success ? booking.data : undefined };
}
