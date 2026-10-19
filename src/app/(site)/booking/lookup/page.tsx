import { CircleCheck } from 'lucide-react';
import { type Metadata } from 'next';

import { SetupNotice } from '@/components/layout/setup-notice';
import { PageHeader } from '@/components/ui/primitives';
import { getBrandInfo } from '@/features/brand/queries';
import { LookupPanel } from '@/features/booking/components/lookup-panel';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Tra cứu đơn', robots: { index: false } };

const PERKS = [
  'Quên mã? Tìm bằng số điện thoại đã đặt',
  'Xem sân đặt hôm nay, sắp tới và lịch sử',
  'Theo dõi thanh toán, tự hủy trước giờ chơi',
];

function LookupIntro() {
  return (
    <div className="flex flex-col gap-5">
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-paper/20">
        <span aria-hidden className="size-2 rounded-full bg-shuttle" />
        Không cần tài khoản
      </span>
      <h1 id="lookup-title" className="text-[2.75rem] leading-[1.05] font-semibold sm:text-6xl lg:text-7xl">
        Tra cứu
        <br />
        <span className="text-court">đơn đặt sân</span>
      </h1>
      <p className="max-w-md text-[0.95rem] text-paper/75 sm:text-lg">
        Đặt sân không cần tài khoản? Chỉ cần số điện thoại bạn đã dùng khi đặt — xem ngay sân, giờ chơi và tình trạng thanh toán.
      </p>
      <ul className="flex flex-col gap-2.5 text-sm text-paper/85 sm:text-[0.95rem]">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-center gap-2.5">
            <CircleCheck className="size-5 shrink-0 text-court" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-10">
        <PageHeader
          title="Tra cứu đơn đặt sân"
          description="Nhập số điện thoại (hoặc mã đơn) đã dùng khi đặt để xem trạng thái hoặc hủy đơn."
        />
        <SetupNotice />
      </div>
    );
  }
  const brand = await getBrandInfo();
  return (
    <LookupPanel
      defaultCode={typeof code === 'string' ? code.slice(0, 20) : ''}
      hotline={brand.hotline}
      intro={<LookupIntro />}
      turnstileSiteKey={publicEnv.turnstileSiteKey}
    />
  );
}
