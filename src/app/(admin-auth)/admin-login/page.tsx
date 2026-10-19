import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SetupNotice } from '@/components/layout/setup-notice';
import { Notice } from '@/components/ui/notice';
import { LoginForm } from '@/features/auth/components/login-form';
import { getStaffContext } from '@/lib/auth/context';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Đăng nhập quản trị', robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (isSupabaseConfigured() && (await getStaffContext())?.isActive)
    redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/admin');
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl">Đăng nhập quản trị</h1>
        <p className="mt-1 text-sm text-muted">Dùng email hoặc số điện thoại được chủ sân cấp.</p>
      </div>
      {error === 'inactive' && <Notice tone="error">Tài khoản đã bị khóa. Liên hệ chủ sân để mở lại.</Notice>}
      {isSupabaseConfigured() ? <LoginForm next={typeof next === 'string' ? next : undefined} /> : <SetupNotice />}
      <p className="text-sm text-muted">Quên mật khẩu? Liên hệ chủ sân để được cấp mật khẩu tạm.</p>
    </div>
  );
}
