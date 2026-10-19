import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBrandInfo } from '@/features/brand/queries';
import { MemberTicket } from '@/features/member/components/member-ticket';
import { getMyBooking, requireMember } from '@/features/member/queries';
import { accountForBranch } from '@/features/payments/lib/transfer';
import { getBankAccounts } from '@/features/payments/queries';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Đơn ${decodeURIComponent(code).slice(0, 20)}` };
}

export default async function MemberBookingPage({ params }: { params: Promise<{ code: string }> }) {
  await requireMember();
  const { code } = await params;
  const [booking, brand, banks] = await Promise.all([
    getMyBooking(decodeURIComponent(code).slice(0, 20)),
    getBrandInfo(),
    getBankAccounts(),
  ]);
  if (!booking) notFound();
  return <MemberTicket booking={booking} hotline={brand.hotline} account={accountForBranch(banks, booking.branch_id)} />;
}
