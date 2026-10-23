import { Check, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';

import { SetupNotice } from '@/components/layout/setup-notice';
import { PageHeader } from '@/components/ui/primitives';
import { getBrandInfo } from '@/features/brand/queries';
import { LookupPanel } from '@/features/booking/components/lookup-panel';
import '@/features/booking/lookup-v8.css';
import { getBankAccounts } from '@/features/payments/queries';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Tra cứu đơn', robots: { index: false } };

const PERKS = [
  'Tra cứu không cần đăng nhập',
  'Kiểm tra sân và giờ chơi',
  'Xem thanh toán và điều kiện hủy',
];

function LookupIntro() {
  return (
    <div className="rally-lookup-intro">
      <p className="rally-lookup-kicker">
        <span aria-hidden className="rally-lookup-pulse" />
        RALLY BADMINTON / TRA CỨU ĐƠN
      </p>
      <h1 id="lookup-title">Lịch sân của bạn, luôn trong tầm tay.</h1>
      <p className="rally-lookup-lead">
        Kiểm tra lịch đặt sân, tình trạng thanh toán và quản lý đơn chỉ bằng số điện thoại hoặc mã đơn.
      </p>
      <ul className="rally-lookup-perks">
        {PERKS.map((perk) => (
          <li key={perk}>
            <Check className="size-4 shrink-0" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
      <p className="rally-lookup-privacy">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        Thông tin đơn được xác minh trước khi hiển thị chi tiết.
      </p>
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
  const [brand, banks] = await Promise.all([getBrandInfo(), getBankAccounts()]);
  return (
    <LookupPanel
      defaultCode={typeof code === 'string' ? code.slice(0, 20) : ''}
      hotline={brand.hotline}
      intro={<LookupIntro />}
      turnstileSiteKey={publicEnv.turnstileSiteKey}
      banks={banks}
    />
  );
}
