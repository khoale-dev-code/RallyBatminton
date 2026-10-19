import { type Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SetupNotice } from '@/components/layout/setup-notice';
import { GoogleButton, OrDivider, RegisterForm } from '@/features/member/components/auth-forms';
import { getMemberProfile } from '@/features/member/queries';
import { safeMemberNext } from '@/features/member/schemas';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Đăng ký thành viên', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = typeof next === 'string' ? safeMemberNext(next) : undefined;
  if (await getMemberProfile()) redirect(target ?? '/account');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl sm:text-5xl">Đăng ký thành viên</h1>
        <p className="text-muted">Miễn phí. Bạn vẫn có thể đặt sân không cần tài khoản bất cứ lúc nào.</p>
      </div>
      {isSupabaseConfigured() ? (
        <>
          <GoogleButton next={target} label="Đăng ký nhanh với Google" />
          <OrDivider />
          <RegisterForm turnstileSiteKey={publicEnv.turnstileSiteKey} next={target} />
        </>
      ) : (
        <SetupNotice />
      )}
      <p className="text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link
          href={target ? `/login?next=${encodeURIComponent(target)}` : '/login'}
          className="font-semibold text-court-deep hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
