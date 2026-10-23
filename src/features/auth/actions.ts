'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getAuthUserId, parseStaffContext, rememberStaffContext } from '@/lib/auth/context';
import { clearStaffContextCache } from '@/lib/auth/context-cache';
import { needsMfa } from '@/lib/auth/permissions';
import { safeAdminPath } from '@/lib/auth/safe-path';
import { loginLockSeconds, recordLoginResult } from '@/features/security/login-guard';
import { lockMessage } from '@/features/security/lib/settings';
import { formError, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { zText } from '@/lib/validation';

const GENERIC_LOGIN_ERROR = 'Email/số điện thoại hoặc mật khẩu không đúng.';

const signInSchema = z.object({
  login: zText('email hoặc số điện thoại', 3, 120),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
  next: z.string().optional(),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    login: formData.get('login'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return formZodError(parsed.error);
  const { login, password, next } = parsed.data;

  // Chống dò mật khẩu: sai nhiều lần → khóa tạm theo tài khoản và theo mạng (23_security_hardening.sql).
  const lockSeconds = await loginLockSeconds('staff', login);
  if (lockSeconds > 0) return formError(lockMessage(lockSeconds));

  let email = login.toLowerCase();
  if (!login.includes('@')) {
    // Số điện thoại là bí danh: máy chủ tra email tương ứng (không lộ thông tin nếu không tồn tại).
    let resolved: string | null = null;
    try {
      const { data, error } = await createSecretClient().rpc('resolve_staff_login', { p_login: login });
      resolved = error ? null : data;
    } catch {
      return formError('Đăng nhập bằng số điện thoại cần cấu hình SUPABASE_SECRET_KEY trên máy chủ. Hãy dùng email.');
    }
    if (!resolved) {
      await recordLoginResult('staff', login, false);
      return formError(GENERIC_LOGIN_ERROR);
    }
    email = resolved;
  }

  const supabase = await createClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordLoginResult('staff', login, false);
    return formError(GENERIC_LOGIN_ERROR);
  }
  // Trang này chỉ dành cho nhân sự: tài khoản khách (thành viên) bị đăng xuất ngay.
  const { data: staff } = await supabase.rpc('my_staff_context');
  const ctx = staff ? parseStaffContext(staff) : null;
  if (!ctx) {
    await supabase.auth.signOut();
    await recordLoginResult('staff', login, false);
    return formError(GENERIC_LOGIN_ERROR);
  }
  await recordLoginResult('staff', login, true);
  const destination = safeAdminPath(next);
  // Đã cài xác thực 2 lớp (hoặc chủ sân bắt buộc): nhập mã / cài đặt trước khi vào trang quản trị.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if ((aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') || needsMfa(ctx)) {
    redirect(`/admin-mfa?next=${encodeURIComponent(destination)}`);
  }
  // Trang quản trị đầu tiên sau đăng nhập không phải hỏi lại quyền.
  rememberStaffContext(signedIn.session, ctx);
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  clearStaffContextCache();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin-login');
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(72, 'Mật khẩu tối đa 72 ký tự')
      .regex(/[A-Za-z]/, 'Cần có ít nhất một chữ cái')
      .regex(/\d/, 'Cần có ít nhất một chữ số'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Hai lần nhập không khớp', path: ['confirm'] });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return formZodError(parsed.error);
  const userId = await getAuthUserId();
  if (!userId) redirect('/admin-login');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return formError(
      error.message.toLowerCase().includes('different')
        ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
        : 'Không đổi được mật khẩu. Vui lòng đăng nhập lại rồi thử lại.',
    );
  }
  try {
    await createSecretClient().rpc('service_mark_password_changed', { p_user_id: userId });
    clearStaffContextCache();
  } catch {
    return formError('Đã đổi mật khẩu nhưng máy chủ chưa cấu hình SUPABASE_SECRET_KEY để mở khóa tài khoản.');
  }
  redirect('/admin');
}
