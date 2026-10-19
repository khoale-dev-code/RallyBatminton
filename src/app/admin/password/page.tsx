import { type Metadata } from 'next';

import { ActionForm, PasswordField, SubmitButton } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { changePasswordAction } from '@/features/auth/actions';
import { requireStaff } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Đổi mật khẩu' };

export default async function PasswordPage() {
  const ctx = await requireStaff({ allowPasswordChange: true });
  return (
    <div className="max-w-lg">
      <PageHeader title="Đổi mật khẩu" />
      {ctx.mustChangePassword && (
        <Notice tone="warning" className="mb-6">
          Bạn đang dùng mật khẩu tạm do chủ sân cấp. Hãy đặt mật khẩu riêng để tiếp tục.
        </Notice>
      )}
      <Panel>
        <ActionForm action={changePasswordAction}>
          <PasswordField
            name="password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            hint="Tối thiểu 8 ký tự, có chữ và số."
            required
          />
          <PasswordField name="confirm" label="Nhập lại mật khẩu mới" autoComplete="new-password" required />
          <SubmitButton pendingLabel="Đang lưu…">Lưu mật khẩu</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
