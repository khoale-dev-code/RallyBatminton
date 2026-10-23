import { type Metadata } from 'next';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { signOutAction } from '@/features/auth/actions';
import { MfaChallenge, MfaEnroll } from '@/features/security/components/mfa-forms';
import { getStaffContext } from '@/lib/auth/context';
import { safeAdminPath } from '@/lib/auth/safe-path';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Xác thực 2 lớp', robots: { index: false, follow: false } };

/**
 * Bước 2 của đăng nhập quản trị: nhập mã từ ứng dụng xác thực (đã cài), hoặc cài lần đầu.
 * ?setup=1 từ trang Bảo mật: thêm thiết bị mới khi đang ở phiên 2 lớp.
 */
export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ next?: string; setup?: string }> }) {
  const { next: rawNext, setup } = await searchParams;
  const next = safeAdminPath(rawNext);
  const ctx = await getStaffContext();
  if (!ctx) redirect(`/admin-login?next=${encodeURIComponent(next)}`);
  if (!ctx.isActive) redirect('/admin-login?error=inactive');

  const supabase = await createClient();
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const verified = (factors?.totp ?? []).filter((f) => f.status === 'verified');
  const atAal2 = aal?.currentLevel === 'aal2';

  let body: ReactNode;
  let title = 'Xác thực 2 lớp';
  if (verified.length > 0 && !atAal2) {
    body = <MfaChallenge factorId={verified[0].id} next={next} />;
    title = 'Nhập mã xác thực';
  } else if (verified.length === 0 || (setup === '1' && atAal2)) {
    body = <MfaEnroll next={next} required={ctx.mfaRequired} />;
    title = verified.length === 0 ? 'Cài xác thực 2 lớp' : 'Thêm thiết bị xác thực';
  } else {
    redirect(next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">Tài khoản: {ctx.displayName}</p>
      </div>
      {body}
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-muted underline-offset-4 hover:underline">
          Đăng xuất / dùng tài khoản khác
        </button>
      </form>
    </div>
  );
}
