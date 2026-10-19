'use client';

import { ActionForm, PasswordField, SubmitButton, TextField } from '@/components/ui/form';

import { signInAction } from '../actions';

/** Form đăng nhập NỘI BỘ (chủ sân, nhân viên). Khách dùng form riêng ở /login. */
export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signInAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <TextField name="login" label="Email hoặc số điện thoại" autoComplete="username" required autoFocus />
      <PasswordField name="password" label="Mật khẩu" autoComplete="current-password" required />
      <SubmitButton size="lg" pendingLabel="Đang đăng nhập…">
        Đăng nhập
      </SubmitButton>
    </ActionForm>
  );
}
