import { ArrowRight, CalendarDays, Map } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { CourtDraw } from '@/components/motion/court-draw';
import { Reveal } from '@/components/motion/reveal';
import { SplitHeading } from '@/components/motion/split-heading';
import { EmptyState } from '@/components/ui/primitives';
import { bookingHref } from '@/features/booking/lib/links';
import { BranchShowcase } from '@/features/branches/components/branch-showcase';
import { getHomeBranches } from '@/features/home/queries';
import { formatDateKey, formatNumber, formatVnd } from '@/lib/format';
import { isDateKey } from '@/lib/time';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Chi nhánh',
  description: 'Hệ thống chi nhánh sân cầu lông Rally: địa chỉ, giờ mở cửa, số sân, giá và giờ trống hôm nay.',
};

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ date?: string; time?: string }> }) {
  const [result, sp] = await Promise.all([getHomeBranches(new Date()), searchParams]);
  // Từ ô tìm giờ trống ở trang chủ: giữ ngày/giờ đã chọn khi bấm Đặt sân.
  const date = sp.date && isDateKey(sp.date) ? sp.date : null;
  const time = sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : null;
  const branches = result.ok ? result.data : [];
  const courts = branches.reduce((n, b) => n + b.courtCount, 0);
  const minPrice = branches.reduce<number | null>((m, b) => (b.minPrice !== null && (m === null || b.minPrice < m) ? b.minPrice : m), null);
  const openNow = branches.filter((b) => b.isOpen).length;

  return (
    <>
      <section aria-labelledby="branches-title" className="full-bleed relative isolate overflow-hidden bg-ink text-paper">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_24rem_at_15%_-20%,rgb(98_187_70/0.35),transparent_65%)]"
        />
        <CourtDraw className="absolute top-1/2 right-[-6rem] -z-10 hidden h-[150%] -translate-y-1/2 rotate-[-58deg] text-court/35 md:block" />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:pb-28">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-paper/20">
            <span aria-hidden className="size-2 rounded-full bg-shuttle" />
            Hệ thống sân Rally
          </span>
          <SplitHeading
            as="h1"
            id="branches-title"
            className="max-w-3xl text-[2.75rem] leading-[1.02] font-semibold sm:text-6xl lg:text-7xl"
          >
            Chọn sân gần bạn, <span className="text-court">ra sân ngay.</span>
          </SplitHeading>
          <p className="max-w-xl text-paper/75 sm:text-lg">
            {date
              ? `Đang tìm giờ trống ngày ${formatDateKey(date)}${time ? `, từ ${time}` : ''} — chọn chi nhánh để giữ sân.`
              : 'Giờ trống cập nhật trực tiếp ở từng chi nhánh. Chạm một giờ để giữ sân trong một phút.'}
          </p>
          {branches.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-paper/60">Chi nhánh</dt>
                <dd className="font-display text-3xl tabular">{branches.length}</dd>
              </div>
              <div>
                <dt className="text-paper/60">Tổng số sân</dt>
                <dd className="font-display text-3xl tabular">{formatNumber(courts)}</dd>
              </div>
              <div>
                <dt className="text-paper/60">Đang mở cửa</dt>
                <dd className="font-display text-3xl text-court tabular">{openNow}</dd>
              </div>
              {minPrice !== null && (
                <div>
                  <dt className="text-paper/60">Giá từ</dt>
                  <dd className="font-display text-3xl tabular">
                    {formatVnd(minPrice)}
                    <span className="font-sans text-sm text-paper/60">/giờ</span>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>

      <div className="relative -mt-14 pb-4 sm:-mt-16">
        {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
        {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
        {result.ok && branches.length === 0 && <EmptyState title="Chưa có chi nhánh mở đặt sân" />}
        {branches.length > 0 && <BranchShowcase branches={branches} date={date} time={time} />}
      </div>

      <Reveal className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2">
        <Link
          data-reveal
          href={bookingHref(null, { date })}
          className="group relative isolate flex items-center gap-4 overflow-hidden rounded-[1.25rem] bg-court p-5 text-on-court sm:p-6"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-paper">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-display text-2xl leading-tight">Xem lịch trống mọi chi nhánh</span>
            <span className="text-sm text-ink/75">Chọn chi nhánh, ngày và giờ trên một trang.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
        <Link
          data-reveal
          href="/about#ban-do"
          className="group flex items-center gap-4 rounded-[1.25rem] border border-line bg-paper p-5 sm:p-6"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-shuttle text-paper">
            <Map className="size-5" aria-hidden />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-display text-2xl leading-tight">Bản đồ & giới thiệu sân</span>
            <span className="text-sm text-muted">Địa chỉ cụ thể, chỉ đường và tiện ích từng nơi.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      </Reveal>
    </>
  );
}
