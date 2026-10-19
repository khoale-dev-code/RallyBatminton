import { type Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SetupNotice } from '@/components/layout/setup-notice';
import { Notice } from '@/components/ui/notice';
import { GoogleButton, MemberLoginForm, OrDivider } from '@/features/member/components/auth-forms';
import { getMemberProfile } from '@/features/member/queries';
import { safeMemberNext } from '@/features/member/schemas';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Đăng nhập', robots: { index: false } };

const ERRORS: Record<string, string> = {
  staff: 'Tài khoản này không dùng cho khách hàng.',
  locked: 'Tài khoản đang bị khóa. Vui lòng liên hệ quầy hoặc hotline.',
  link: 'Liên kết đã hết hạn hoặc đã được dùng. Vui lòng thử lại.',
  callback: 'Chưa đăng nhập được. Vui lòng thử lại.',
  cancelled: 'Bạn đã hủy đăng nhập bằng Google. Có thể thử lại hoặc dùng số điện thoại / email.',
};

export default async function MemberLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = typeof next === 'string' ? safeMemberNext(next) : undefined;
  if (await getMemberProfile()) redirect(target ?? '/account');
  const errorText = typeof error === 'string' ? ERRORS[error] : undefined;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl sm:text-5xl">Đăng nhập</h1>
        <p className="text-muted">Xem mọi đơn đã đặt, đặt sân nhanh và tích điểm thành viên.</p>
      </div>
      {errorText && <Notice tone="error">{errorText}</Notice>}
      {isSupabaseConfigured() ? (
        <>
          <GoogleButton next={target} />
          <OrDivider />
          <MemberLoginForm next={target} />
        </>
      ) : (
        <SetupNotice />
      )}
      <p className="text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link
          href={target ? `/register?next=${encodeURIComponent(target)}` : '/register'}
          className="font-semibold text-court-deep hover:underline"
        >
          Đăng ký thành viên
        </Link>
      </p>
    </div>
  );
}
