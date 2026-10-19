import { Check, Clock3, MapPin, Navigation, Phone, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { EmptyState, Panel } from '@/components/ui/primitives';
import { BookingBoard } from '@/features/booking/components/booking-board';
import { BookingSteps } from '@/features/booking/components/booking-steps';
import { bookingHref } from '@/features/booking/lib/links';
import { getBrandInfo } from '@/features/brand/queries';
import { bookingBoardProps } from '@/features/branches/board-props';
import { PriceTable } from '@/features/branches/components/price-table';
import { mapDirectionsHref } from '@/features/branches/lib/map-embed';
import { getBranchDetail, listPublishedBranches } from '@/features/branches/queries';
import { cn } from '@/lib/cn';
import { formatPhone, formatVnd } from '@/lib/format';
import { isDateKey, shortTime } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Đặt sân',
  description: 'Đặt sân cầu lông Rally trực tuyến: chọn chi nhánh, xem giờ trống theo từng sân và giữ chỗ trong một phút.',
};

type Search = { branch?: string; date?: string; time?: string };

export default async function BookingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [list, sp, brand] = await Promise.all([listPublishedBranches(), searchParams, getBrandInfo()]);
  const date = sp.date && isDateKey(sp.date) ? sp.date : null;
  const branches = list.ok ? list.data : [];
  const selected = branches.find((b) => b.slug === sp.branch) ?? (branches.length === 1 ? branches[0] : undefined);
  const detail = selected ? await getBranchDetail(selected.slug) : null;

  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold tracking-[0.2em] text-court-strong uppercase">
            <span aria-hidden className="size-2 rounded-full bg-shuttle" />
            Đặt sân trực tuyến
          </span>
          <h1 className="text-[2.5rem] leading-[1.05] sm:text-6xl">
            {detail ? (
              <>
                Đặt sân tại <span className="text-court-strong">{detail.branch.name}</span>
              </>
            ) : (
              'Bạn muốn chơi ở đâu?'
            )}
          </h1>
        </div>
        <div className="w-full lg:max-w-md">
          <BookingSteps current={detail ? 1 : 0} />
        </div>
      </header>

      {!list.ok && list.reason === 'not_configured' && <SetupNotice />}
      {!list.ok && list.reason === 'error' && <LoadErrorNotice />}
      {list.ok && branches.length === 0 && <EmptyState title="Chưa có chi nhánh mở đặt sân" />}

      {branches.length > 1 && (
        <nav aria-label="Chọn chi nhánh" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">1. Chọn chi nhánh</h2>
          <ul className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
            {branches.map((b) => {
              const active = b.id === selected?.id;
              return (
                <li key={b.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <Link
                    href={bookingHref(b.slug, { date })}
                    scroll={false}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'group relative flex h-full flex-col gap-1 overflow-hidden rounded-panel border p-4 transition-all duration-200',
                      active
                        ? 'border-ink bg-ink text-paper shadow-lift'
                        : 'border-line bg-paper hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-lift',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-display text-xl leading-tight">{b.name}</span>
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                          active ? 'bg-court text-ink' : 'border border-line text-transparent group-hover:border-ink/40',
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                    </span>
                    <span className={cn('text-sm', active ? 'text-paper/70' : 'text-muted')}>
                      {[b.district, b.city].filter(Boolean).join(', ')}
                    </span>
                    <span className={cn('mt-2 flex flex-wrap gap-x-3 text-sm tabular', active ? 'text-paper/85' : '')}>
                      <span>
                        {shortTime(b.opensAt)}–{shortTime(b.closesAt)}
                      </span>
                      <span>{b.courtCount} sân</span>
                      {b.minPrice !== null && (
                        <span className={active ? 'text-court' : 'text-shuttle-deep'}>từ {formatVnd(b.minPrice)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {!detail && branches.length > 1 && (
        <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-line bg-hall/60 px-6 py-14 text-center">
          <MapPin className="size-8 text-court-strong" aria-hidden />
          <p className="font-display text-2xl">Chọn một chi nhánh ở trên để xem giờ trống</p>
          <p className="max-w-md text-sm text-muted">
            Lịch trống cập nhật trực tiếp theo từng sân. Chưa biết chọn nơi nào?{' '}
            <Link href="/about#ban-do" className="font-medium text-court-deep underline-offset-4 hover:underline">
              Xem bản đồ chi nhánh
            </Link>
            .
          </p>
        </div>
      )}

      {detail && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section id="chon-gio" aria-labelledby="board-title" className="min-w-0 scroll-mt-24">
            <h2 id="board-title" className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">
              2. Chọn sân & giờ
            </h2>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-panel bg-hall" />}>
              <BookingBoard key={detail.branch.id} {...bookingBoardProps(detail, brand)} />
            </Suspense>
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <div className="relative isolate overflow-hidden rounded-[1.25rem] bg-ink p-5 text-paper">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-court" />
              <p className="font-display text-2xl">{detail.branch.name}</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-paper/80">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-court" aria-hidden />
                  {[detail.branch.address_line, detail.branch.ward, detail.branch.district, detail.branch.city].filter(Boolean).join(', ')}
                </li>
                <li className="flex items-center gap-2">
                  <Clock3 className="size-4 shrink-0 text-court" aria-hidden />
                  Mở cửa {shortTime(detail.branch.opens_at)}–{shortTime(detail.branch.closes_at)} hằng ngày
                </li>
                {detail.branch.phone && (
                  <li>
                    <a href={`tel:${detail.branch.phone}`} className="flex items-center gap-2 hover:text-paper">
                      <Phone className="size-4 shrink-0 text-court" aria-hidden />
                      {formatPhone(detail.branch.phone)}
                    </a>
                  </li>
                )}
              </ul>
              <div className="mt-4 flex gap-2">
                <a
                  href={mapDirectionsHref(
                    detail.branch.map_url,
                    [detail.branch.name, detail.branch.address_line, detail.branch.district, detail.branch.city].filter(Boolean).join(', '),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-control bg-paper text-sm font-medium text-ink hover:bg-paper/90"
                >
                  <Navigation className="size-4" aria-hidden />
                  Chỉ đường
                </a>
                <Link
                  href={`/branches/${detail.branch.slug}`}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-control text-sm font-medium ring-1 ring-paper/30 hover:bg-paper/10"
                >
                  Xem chi nhánh
                </Link>
              </div>
            </div>
            <Panel title="Bảng giá">
              <PriceTable rules={detail.priceRules} courtNames={Object.fromEntries(detail.courts.map((c) => [c.id, c.name]))} />
            </Panel>
            <div className="flex gap-3 rounded-panel bg-court-soft p-4 text-sm text-court-deep">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                Giữ chỗ {detail.branch.hold_minutes} phút, cọc {detail.branch.deposit_percent}%. Hủy trước {detail.branch.free_cancel_hours}{' '}
                giờ hoàn toàn bộ cọc; trước {detail.branch.partial_refund_hours} giờ hoàn {detail.branch.partial_refund_percent}%.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
