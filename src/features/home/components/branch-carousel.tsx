'use client';

import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';

import { MediaImage } from '@/components/brand/media-image';
import { buttonClass } from '@/components/ui/button';
import { bookingHref } from '@/features/booking/lib/links';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

import { type HomeBranch } from '../queries';

import { HallScene } from './hall-scene';

function slotHref(b: HomeBranch, start?: string): string {
  return bookingHref(b.slug, { date: b.slotsDate, time: start });
}

function BranchCard({ b }: { b: HomeBranch }) {
  const address = [b.addressLine, b.district].filter(Boolean).join(', ');
  const firstFree = b.slots.find((s) => s.freeCourts > 0)?.start;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-paper transition-shadow duration-200 hover:shadow-lift">
      <Link
        href={`/branches/${b.slug}`}
        className="relative block aspect-[16/9] overflow-hidden bg-hall-dark lg:aspect-[2/1]"
        tabIndex={-1}
        aria-hidden
      >
        {b.coverImagePath ? (
          <MediaImage path={b.coverImagePath} alt={b.name} className="h-full w-full" sizes="(min-width: 1024px) 380px, 85vw" />
        ) : (
          <HallScene
            showSlogan={false}
            title={b.name}
            className="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-paper/95 px-2.5 py-1 text-xs font-medium shadow-sm">
          <span className="font-display text-sm">{b.courtCount}</span> sân
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl leading-snug">
            <Link
              href={`/branches/${b.slug}`}
              className="hover:underline hover:decoration-court hover:decoration-2 hover:underline-offset-4"
            >
              {b.name}
            </Link>
          </h3>
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="line-clamp-1">{address}</span>
          </p>
          {b.minPrice !== null && (
            <p className="text-sm">
              Giá từ <span className="font-display text-lg text-shuttle-deep tabular">{formatVnd(b.minPrice)}</span>
              <span className="text-shuttle-deep">/giờ</span>
            </p>
          )}
        </div>

        {b.slots.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{b.slotsIsToday ? 'Giờ trống hôm nay' : 'Giờ trống ngày mai'}</span>
            <ul className="grid grid-cols-4 gap-1.5">
              {b.slots.map((s) => {
                const full = s.freeCourts === 0;
                return (
                  <li key={s.start}>
                    {full ? (
                      <span
                        className="flex h-10 flex-col items-center justify-center rounded-control border border-dashed border-line text-xs text-muted/70 tabular line-through"
                        title="Hết sân"
                      >
                        {s.start}
                      </span>
                    ) : (
                      <Link
                        href={slotHref(b, s.start)}
                        title={`Còn ${s.freeCourts} sân`}
                        className={cn(
                          'flex h-10 items-center justify-center rounded-control border text-sm tabular transition-colors',
                          s.start === firstFree
                            ? 'border-court bg-court-soft font-medium text-court-deep'
                            : 'border-line hover:border-court hover:bg-court-soft',
                        )}
                      >
                        {s.start}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className={cn('inline-flex items-center gap-1.5', b.isOpen ? 'text-court-deep' : 'text-muted')}>
            <span aria-hidden className={cn('size-2 rounded-full', b.isOpen ? 'bg-court' : 'bg-muted/50')} />
            {b.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa'}
            <span className="text-muted tabular">
              · {shortTime(b.opensAt)} – {shortTime(b.closesAt)}
            </span>
          </span>
        </p>

        <Link href={slotHref(b, firstFree)} className={buttonClass('brand', 'md', 'mt-auto w-full')}>
          Xem giờ trống
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** Thẻ chi nhánh cuộn ngang (vuốt trên điện thoại, nút trước/sau trên máy tính). */
export function BranchCarousel({ branches, heading, action }: { branches: HomeBranch[]; heading: ReactNode; action?: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('li');
    el.scrollBy({ left: dir * ((card?.clientWidth ?? el.clientWidth) + 16), behavior: 'smooth' });
  };
  const arrowClass =
    'hidden size-10 place-items-center rounded-full border border-line bg-paper transition-colors hover:border-ink sm:grid';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        {heading}
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {branches.length > 2 && (
            <>
              <button type="button" onClick={() => scroll(-1)} aria-label="Chi nhánh trước" className={arrowClass}>
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Chi nhánh sau" className={arrowClass}>
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <ul
        ref={track}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {branches.map((b) => (
          <li
            key={b.id}
            className={cn('w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)]', branches.length > 2 && 'lg:w-[calc((100%-2rem)/3)]')}
          >
            <BranchCard b={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
