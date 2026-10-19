import { KeyRound, Link2, ShieldCheck, UserRound } from 'lucide-react';
import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import { Notice } from '@/components/ui/notice';
import { MemberPasswordForm, ProfileForm } from '@/features/member/components/member-forms';
import { requireMember } from '@/features/member/queries';
import { formatPhone } from '@/lib/format';

export const metadata: Metadata = { title: 'Hồ sơ & bảo mật' };

const LOGIN_KIND = { phone: 'Số điện thoại', email: 'Email', google: 'Google' } as const;

function Section({
  id,
  icon,
  title,
  description,
  children,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-title`} className="scroll-mt-24 rounded-panel border border-line bg-paper p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-soft text-court-deep">{icon}</span>
        <div>
          <h2 id={`${id ?? title}-title`} className="text-xl">
            {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function MemberProfilePage({ searchParams }: { searchParams: Promise<{ 'doi-mat-khau'?: string }> }) {
  const [profile, params] = await Promise.all([requireMember({ allowPasswordChange: true }), searchParams]);
  const forced = params['doi-mat-khau'] === '1' || profile.must_change_password;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Section icon={<UserRound className="size-5" aria-hidden />} title="Hồ sơ" description="Thông tin được điền sẵn khi bạn đặt sân.">
        <ProfileForm profile={profile} />
      </Section>
      <div className="flex flex-col gap-6">
        <Section
          id="mat-khau"
          icon={<KeyRound className="size-5" aria-hidden />}
          title={profile.has_password ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
          description={
            profile.has_password
              ? 'Tối thiểu 8 ký tự, gồm chữ và số.'
              : 'Tài khoản đang đăng nhập bằng Google. Tạo mật khẩu để đăng nhập thêm bằng email.'
          }
        >
          {forced && profile.must_change_password && (
            <Notice tone="warning" className="mb-4">
              Bạn đang dùng mật khẩu tạm. Nhập mật khẩu tạm ở ô &quot;Mật khẩu hiện tại&quot; rồi đặt mật khẩu mới.
            </Notice>
          )}
          <MemberPasswordForm hasPassword={profile.has_password} />
        </Section>
        <Section
          icon={<ShieldCheck className="size-5" aria-hidden />}
          title="Cách đăng nhập"
          description="Các cách bạn có thể vào tài khoản."
        >
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between gap-3 rounded-control bg-hall px-3 py-2.5">
              <span className="inline-flex items-center gap-2">
                <Link2 className="size-4 text-muted" aria-hidden />
                Đăng ký bằng
              </span>
              <span className="font-medium">{LOGIN_KIND[profile.login_kind]}</span>
            </li>
            {profile.phone && (
              <li className="flex items-center justify-between gap-3 rounded-control bg-hall px-3 py-2.5">
                <span>Số điện thoại + mật khẩu</span>
                <span className="font-medium tabular">{formatPhone(profile.phone)}</span>
              </li>
            )}
            {profile.email && (
              <li className="flex items-center justify-between gap-3 rounded-control bg-hall px-3 py-2.5">
                <span>Email{profile.login_kind === 'google' ? ' (Google)' : ' + mật khẩu'}</span>
                <span className="truncate font-medium">{profile.email}</span>
              </li>
            )}
          </ul>
          {profile.login_kind === 'phone' && (
            <p className="mt-3 text-sm text-muted">
              Quên mật khẩu tài khoản số điện thoại: liên hệ quầy hoặc hotline để được cấp mật khẩu tạm.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
