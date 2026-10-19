import { LogOut } from 'lucide-react';
import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import { Notice } from '@/components/ui/notice';
import { memberSignOutAction } from '@/features/member/actions';
import { AccountTabs } from '@/features/member/components/account-tabs';
import { requireMember } from '@/features/member/queries';

export const metadata: Metadata = {
  title: { default: 'Tài khoản', template: '%s | Tài khoản Rally' },
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const profile = await requireMember({ allowPasswordChange: true });
  return (
    <div className="flex flex-col gap-6 py-8 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">Xin chào,</p>
          <h1 className="text-[2rem] leading-tight sm:text-4xl">{profile.full_name}</h1>
        </div>
        <form action={memberSignOutAction}>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted hover:text-shuttle-deep">
            <LogOut className="size-4" aria-hidden />
            Đăng xuất
          </button>
        </form>
      </div>
      <AccountTabs />
      {profile.must_change_password && (
        <Notice tone="warning" title="Hãy đổi mật khẩu">
          Bạn đang dùng mật khẩu tạm do nhân viên cấp. Vui lòng đặt mật khẩu mới ở mục Hồ sơ &amp; bảo mật.
        </Notice>
      )}
      {children}
    </div>
  );
}
