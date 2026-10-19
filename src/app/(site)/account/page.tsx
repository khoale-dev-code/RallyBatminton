import { ArrowRight, Gift, Minus, Plus, TicketPlus } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/primitives';
import { MemberBookingCard } from '@/features/member/components/member-booking-card';
import { MemberCard } from '@/features/member/components/member-card';
import { ClaimBookingForm } from '@/features/member/components/member-forms';
import { MEMBER_TIERS, VND_PER_POINT } from '@/features/member/lib/tiers';
import { listMyBookings, listMyPoints, requireMember } from '@/features/member/queries';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatVnd } from '@/lib/format';
import { requestNow } from '@/lib/time';

export const metadata: Metadata = { title: 'Tổng quan' };

const ACTIVE = new Set(['held', 'confirmed', 'checked_in']);

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; password?: string }> }) {
  // Một lượt song song: hồ sơ + đơn + điểm (RLS giới hạn theo tài khoản đang đăng nhập).
  const profilePromise = requireMember();
  const [profile, params, bookings, points] = await Promise.all([
    profilePromise,
    searchParams,
    listMyBookings(),
    listMyPoints(
      profilePromise.then((p) => p.user_id),
      8,
    ),
  ]);
  const now = requestNow();
  const upcoming = bookings
    .filter((b) => ACTIVE.has(b.status) && new Date(b.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const played = bookings.filter((b) => b.status === 'completed').length;

  return (
    <div className="flex flex-col gap-6">
      {params.welcome === '1' && (
        <Notice title="Chào mừng bạn đến với Rally!">
          Tài khoản đã sẵn sàng. Từ nay các đơn bạn đặt khi đăng nhập sẽ tự lưu ở đây và được cộng điểm khi hoàn tất.
        </Notice>
      )}
      {params.password === 'updated' && <Notice>Đã cập nhật mật khẩu mới.</Notice>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <h2 id="upcoming-title" className="text-2xl">
                Lịch sắp tới
              </h2>
              <Link href="/account/bookings" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
                Tất cả đơn
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Chưa có lịch nào sắp tới"
                action={
                  <Link href="/booking" className={buttonClass('brand')}>
                    Đặt sân ngay
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                }
              >
                Đặt sân khi đang đăng nhập để đơn tự lưu vào tài khoản và được tích điểm.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upcoming.slice(0, 4).map((b) => (
                  <li key={b.booking_id}>
                    <MemberBookingCard booking={b} upcoming />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="claim-title" className="flex flex-col gap-3 rounded-panel border border-line bg-paper p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-soft text-court-deep">
                <TicketPlus className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id="claim-title" className="text-xl">
                  Thêm đơn đã đặt trước đây
                </h2>
                <p className="text-sm text-muted">
                  Đơn đặt lúc chưa đăng nhập? Nhập mã đơn và số điện thoại đã dùng để đưa vào tài khoản — đơn đã hoàn tất cũng được cộng
                  điểm.
                </p>
              </div>
            </div>
            <ClaimBookingForm defaultPhone={profile.phone} />
          </section>
        </div>

        <aside className="order-first flex flex-col gap-4 lg:order-none">
          <MemberCard profile={profile} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-panel border border-line bg-paper p-4">
              <p className="text-sm text-muted">Trận đã chơi</p>
              <p className="font-display text-3xl tabular">{played}</p>
            </div>
            <div className="rounded-panel border border-line bg-paper p-4">
              <p className="text-sm text-muted">Tổng điểm tích</p>
              <p className="font-display text-3xl tabular">{formatNumber(profile.lifetime_points)}</p>
            </div>
          </div>
          <section aria-labelledby="points-title" className="rounded-panel border border-line bg-paper p-4 sm:p-5">
            <h2 id="points-title" className="flex items-center gap-2 text-xl">
              <Gift className="size-5 text-court-deep" aria-hidden />
              Lịch sử điểm
            </h2>
            <p className="mt-1 text-sm text-muted">1 điểm cho mỗi {formatVnd(VND_PER_POINT)} tiền sân, cộng khi đơn hoàn tất.</p>
            {points.length === 0 ? (
              <p className="mt-3 rounded-control bg-hall px-3 py-2.5 text-sm text-muted">Chưa có điểm nào — chơi trận đầu tiên nhé!</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {points.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full',
                        p.delta > 0 ? 'bg-court-soft text-court-deep' : 'bg-shuttle-soft text-shuttle-deep',
                      )}
                    >
                      {p.delta > 0 ? <Plus className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{p.reason}</span>
                      <span className="text-xs text-muted">{formatDate(p.createdAt)}</span>
                    </span>
                    <span className={cn('font-semibold tabular', p.delta > 0 ? 'text-court-deep' : 'text-shuttle-deep')}>
                      {p.delta > 0 ? '+' : ''}
                      {formatNumber(p.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ol className="mt-4 grid grid-cols-4 gap-1 text-center text-xs">
              {MEMBER_TIERS.map((t) => (
                <li
                  key={t.tier}
                  className={cn('rounded-control px-1 py-2', t.tier === profile.tier ? 'bg-ink text-paper' : 'bg-hall text-muted')}
                >
                  <span className="block font-semibold">{t.label}</span>
                  <span className="tabular">{formatNumber(t.min)}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
