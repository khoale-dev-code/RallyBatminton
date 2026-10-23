import { Clock3, Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { getMemberProfile } from '@/features/member/queries';
import { isMemberAliasEmail } from '@/features/member/schemas';
import { DataRequestForm } from '@/features/privacy/components/data-request-form';
import { LegalNav } from '@/features/privacy/components/legal-nav';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Yêu cầu về dữ liệu cá nhân',
  description: 'Xem, nhận bản sao, sửa, xóa dữ liệu cá nhân hoặc rút lại đồng ý nhận tin tại Rally.',
};

const STEPS = [
  { icon: FileCheck2, title: 'Gửi yêu cầu', text: 'Chọn việc cần làm, để lại số điện thoại hoặc email.' },
  { icon: ShieldCheck, title: 'Xác minh', text: 'Số điện thoại khớp mã đơn → xác minh ngay; nếu không, Rally gọi lại để xác minh.' },
  { icon: Clock3, title: 'Đúng hạn', text: 'Phản hồi trong 2 ngày làm việc, hoàn thành trong 10 – 20 ngày tùy loại yêu cầu.' },
];

export default async function DataRequestPage() {
  const profile = await getMemberProfile();
  return (
    <div className="pt-6 pb-16 sm:pt-10 sm:pb-24">
      <header className="flex flex-col gap-5 border-b border-line pb-8 sm:pb-10">
        <LegalNav active="request" />
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="font-display text-sm tracking-[0.24em] text-court-strong uppercase">Quyền của chủ thể dữ liệu</p>
          <h1 className="text-[2.4rem] leading-[1.05] sm:text-6xl">Yêu cầu về dữ liệu cá nhân</h1>
          <p className="text-lg text-muted">
            Theo Luật Bảo vệ dữ liệu cá nhân, bạn có quyền xem, nhận bản sao, sửa, xóa dữ liệu, rút lại đồng ý hoặc phản đối việc xử lý.
            Không cần tài khoản.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <section aria-label="Gửi yêu cầu" className="min-w-0">
          <DataRequestForm
            turnstileSiteKey={publicEnv.turnstileSiteKey}
            member={
              profile
                ? { name: profile.full_name, phone: profile.phone, email: isMemberAliasEmail(profile.email) ? null : profile.email }
                : null
            }
          />
        </section>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <ol className="flex flex-col gap-3 rounded-2xl bg-hall p-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper">
                  <s.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">
                    {i + 1}. {s.title}
                  </span>
                  <span className="block text-sm text-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-5">
            <Download className="size-5 text-court-deep" aria-hidden />
            <p className="font-medium">Có tài khoản thành viên?</p>
            <p className="text-sm text-muted">Tải ngay toàn bộ dữ liệu và bật / tắt nhận tin trong Tài khoản → Quyền riêng tư.</p>
            <Link href="/account/privacy" className="text-sm font-semibold text-court-deep underline-offset-4 hover:underline">
              Mở Quyền riêng tư
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
