import { type Metadata } from 'next';
import Link from 'next/link';

import { Notice } from '@/components/ui/notice';
import { ResetPasswordForm } from '@/features/member/components/auth-forms';
import { getMemberProfile } from '@/features/member/queries';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu', robots: { index: false } };

export default async function ResetPasswordPage() {
  const profile = await getMemberProfile();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl sm:text-5xl">Đặt mật khẩu mới</h1>
        {profile && <p className="text-muted">Tài khoản: {profile.email ?? profile.phone ?? profile.full_name}</p>}
      </div>
      {profile ? (
        <ResetPasswordForm />
      ) : (
        <>
          <Notice tone="warning">Liên kết đặt lại đã hết hạn hoặc đã được dùng. Vui lòng yêu cầu liên kết mới.</Notice>
          <Link href="/forgot-password" className="text-center text-sm font-semibold text-court-deep hover:underline">
            Gửi lại liên kết
          </Link>
        </>
      )}
    </div>
  );
}
