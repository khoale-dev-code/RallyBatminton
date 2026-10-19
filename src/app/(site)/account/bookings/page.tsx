import { ArrowRight } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { MemberBookingCard } from '@/features/member/components/member-booking-card';
import { listMyBookings, requireMember } from '@/features/member/queries';
import { cn } from '@/lib/cn';
import { requestNow } from '@/lib/time';

export const metadata: Metadata = { title: 'Đơn đặt sân' };

const ACTIVE = new Set(['held', 'confirmed', 'checked_in']);

export default async function MemberBookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireMember();
  const [{ tab }, bookings] = await Promise.all([searchParams, listMyBookings()]);
  const now = requestNow();
  const upcoming = bookings
    .filter((b) => ACTIVE.has(b.status) && new Date(b.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = bookings.filter((b) => !upcoming.includes(b));
  const showPast = tab === 'past';
  const list = showPast ? past : upcoming;
  const tabs = [
    { key: 'upcoming', label: 'Sắp tới', count: upcoming.length, href: '/account/bookings' },
    { key: 'past', label: 'Đã qua & đã hủy', count: past.length, href: '/account/bookings?tab=past' },
  ];

  return (
    <section aria-labelledby="bookings-title" className="flex flex-col gap-4">
      <h2 id="bookings-title" className="sr-only">
        Đơn đặt sân
      </h2>
      <div role="tablist" aria-label="Lọc đơn" className="flex w-fit gap-1 rounded-control bg-hall p-1">
        {tabs.map((t) => {
          const active = (t.key === 'past') === showPast;
          return (
            <Link
              key={t.key}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-[0.4rem] px-4 text-sm font-medium',
                active ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {t.label}
              <span className={cn('rounded-full px-1.5 text-xs tabular', active ? 'bg-ink text-paper' : 'bg-paper')}>{t.count}</span>
            </Link>
          );
        })}
      </div>
      {list.length === 0 ? (
        <EmptyState
          title={showPast ? 'Chưa có đơn nào đã qua' : 'Chưa có lịch sắp tới'}
          action={
            <Link href="/booking" className={buttonClass('brand')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        >
          Đơn đặt lúc chưa đăng nhập có thể thêm vào tài khoản ở trang Tổng quan bằng mã đơn và số điện thoại.
        </EmptyState>
      ) : (
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {list.map((b) => (
            <li key={b.booking_id}>
              <MemberBookingCard booking={b} upcoming={!showPast} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
