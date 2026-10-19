'use client';

import { ArrowRight, ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MediaImage } from '@/components/brand/media-image';
import { gsap, MOTION_OK, useGSAP } from '@/components/motion/gsap';
import { buttonClass } from '@/components/ui/button';
import { bookingHref } from '@/features/booking/lib/links';
import { type HomeBranch } from '@/features/home/queries';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

/** Ảnh dự phòng khi chi nhánh chưa có ảnh bìa: cùng ảnh nhà thi đấu, lệch khung để không lặp nhàm. */
const FALLBACK_POSITIONS = ['object-[50%_70%]', 'object-[20%_60%]', 'object-[80%_55%]', 'object-[35%_85%]'];

function Cover({ b, index, sizes, className }: { b: HomeBranch; index: number; sizes: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden bg-hall-dark', className)}>
      {b.coverImagePath ? (
        <MediaImage
          path={b.coverImagePath}
          alt={b.name}
          sizes={sizes}
          className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.05] motion-reduce:transition-none"
        />
      ) : (
        <Image
          src="/images/hero-court.webp"
          alt=""
          fill
          sizes={sizes}
          className={cn(
            'object-cover transition-transform duration-700 group-hover:scale-[1.05] motion-reduce:transition-none',
            FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length],
          )}
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.05)_30%,rgb(4_24_15/0.85)_100%)]" />
    </div>
  );
}

function OpenBadge({ b }: { b: HomeBranch }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm',
        b.isOpen ? 'bg-paper/95 text-court-deep' : 'bg-ink/70 text-paper',
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', b.isOpen ? 'animate-pulse bg-court' : 'bg-shuttle')} />
      {b.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa'}
    </span>
  );
}

function SlotChips({ b, cols = 4 }: { b: HomeBranch; cols?: 2 | 4 }) {
  if (b.slots.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{b.slotsIsToday ? 'Giờ trống hôm nay' : 'Giờ trống ngày mai'}</span>
      <ul className={cn('grid gap-1.5', cols === 4 ? 'grid-cols-4' : 'grid-cols-2')}>
        {b.slots.map((s) =>
          s.freeCourts === 0 ? (
            <li key={s.start}>
              <span
                title="Hết sân"
                className="flex h-10 items-center justify-center rounded-control border border-dashed border-line text-sm text-muted/60 tabular line-through"
              >
                {s.start}
              </span>
            </li>
          ) : (
            <li key={s.start}>
              <Link
                href={bookingHref(b.slug, { date: b.slotsDate, time: s.start })}
                title={`Còn ${s.freeCourts} sân`}
                className="flex h-10 flex-col items-center justify-center rounded-control border border-line text-sm font-medium tabular transition-colors hover:border-court-strong hover:bg-court-soft hover:text-court-deep"
              >
                {s.start}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function Facts({ b }: { b: HomeBranch }) {
  const address = [b.addressLine, b.district].filter(Boolean).join(', ');
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="flex items-start gap-2 text-muted">
        <MapPin className="mt-0.5 size-4 shrink-0 text-court-strong" aria-hidden />
        <span>{address}</span>
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <Clock3 className="size-4 text-court-strong" aria-hidden />
          <span className="tabular">
            {shortTime(b.opensAt)} – {shortTime(b.closesAt)}
          </span>
        </span>
        {b.minPrice !== null && (
          <span>
            từ <span className="font-display text-lg text-shuttle-deep tabular">{formatVnd(b.minPrice)}</span>
            <span className="text-muted">/giờ</span>
          </span>
        )}
      </p>
    </div>
  );
}

function Actions({ b, date, time }: { b: HomeBranch; date: string | null; time: string | null }) {
  return (
    <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-1">
      <Link href={bookingHref(b.slug, { date: date ?? undefined, time })} className={buttonClass('brand', 'md', 'w-full')}>
        Đặt sân
        <ArrowRight className="size-4" aria-hidden />
      </Link>
      <Link href={`/branches/${b.slug}`} className={buttonClass('outline', 'md')} aria-label={`Chi tiết ${b.name}`}>
        Chi tiết
      </Link>
    </div>
  );
}

/** Thẻ chi nhánh (dùng khi có từ 2 chi nhánh). */
function BranchCard({ b, index, date, time }: { b: HomeBranch; index: number; date: string | null; time: string | null }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-lift motion-reduce:hover:translate-y-0">
      <Link href={`/branches/${b.slug}`} tabIndex={-1} aria-hidden className="relative block">
        <Cover b={b} index={index} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 85vw" className="relative aspect-[16/10]" />
        <span className="absolute top-3 left-3">
          <OpenBadge b={b} />
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-paper backdrop-blur-sm">
          {b.courtCount} sân
        </span>
        <span className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2 text-paper">
          <span className="font-display text-[0.7rem] tracking-[0.3em] text-court uppercase">{String(index + 1).padStart(2, '0')}</span>
          <ArrowUpRight
            className="size-5 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            aria-hidden
          />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <h2 className="text-2xl leading-tight">
          <Link href={`/branches/${b.slug}`} className="hover:text-court-deep">
            {b.name}
          </Link>
        </h2>
        <Facts b={b} />
        <SlotChips b={b} />
        <Actions b={b} date={date} time={time} />
      </div>
    </article>
  );
}

/** Chỉ có 1 chi nhánh: hiển thị toàn chiều rộng như một "trang bìa". */
function FeaturedBranch({ b, date, time }: { b: HomeBranch; date: string | null; time: string | null }) {
  return (
    <article className="group grid overflow-hidden rounded-[1.5rem] border border-line bg-paper shadow-lift lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative min-h-72 sm:min-h-96">
        <Cover b={b} index={0} sizes="(min-width: 1024px) 60vw, 100vw" className="absolute inset-0" />
        <div className="absolute inset-0 flex flex-col justify-between p-5 text-paper sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <OpenBadge b={b} />
            <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">{b.courtCount} sân</span>
          </div>
          <div>
            <p className="font-display text-xs tracking-[0.35em] text-court uppercase">Chi nhánh</p>
            <h2 className="text-5xl leading-none sm:text-6xl lg:text-7xl">{b.name}</h2>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:p-8">
        <Facts b={b} />
        <SlotChips b={b} />
        <div className="grid grid-cols-3 gap-2 rounded-panel bg-hall p-3 text-center">
          <div>
            <p className="font-display text-2xl tabular">{b.courtCount}</p>
            <p className="text-xs text-muted">sân</p>
          </div>
          <div>
            <p className="font-display text-2xl tabular">{shortTime(b.opensAt)}</p>
            <p className="text-xs text-muted">mở cửa</p>
          </div>
          <div>
            <p className="font-display text-2xl tabular">{shortTime(b.closesAt)}</p>
            <p className="text-xs text-muted">đóng cửa</p>
          </div>
        </div>
        <Actions b={b} date={date} time={time} />
        <Link href="/about#ban-do" className="inline-flex items-center gap-1 text-sm font-medium text-court-deep hover:underline">
          Xem bản đồ và giới thiệu sân
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/**
 * Bố cục theo số chi nhánh:
 *  - 1: thẻ lớn toàn chiều rộng.
 *  - 2: hai thẻ ngang nhau (điện thoại: vuốt, lộ nửa thẻ sau).
 *  - 3+: ba thẻ một hàng trên máy tính; máy tính bảng 2 thẻ + vuốt; điện thoại 1 thẻ + nửa thẻ.
 */
export function BranchShowcase({ branches, date, time }: { branches: HomeBranch[]; date: string | null; time: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const count = branches.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from('[data-card]', {
          y: 60,
          autoAlpha: 0,
          rotate: (i: number) => (i % 2 === 0 ? -1.5 : 1.5),
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          clearProps: 'transform',
        });
      });
    },
    { scope: root },
  );

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setScrollable(el.scrollWidth - el.clientWidth > 4);
    const first = el.querySelector('li');
    const step = (first?.clientWidth ?? el.clientWidth) + 16;
    setActive(Math.min(count - 1, Math.round(el.scrollLeft / step)));
  }, [count]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure]);

  const goTo = (i: number) => {
    const el = track.current;
    const item = el?.querySelectorAll('li')[i];
    if (el && item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };

  if (count === 1 && branches[0]) {
    return (
      <div ref={root}>
        <div data-card>
          <FeaturedBranch b={branches[0]} date={date} time={time} />
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      <ul
        ref={track}
        aria-label="Danh sách chi nhánh"
        className={cn(
          'scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6',
          count === 2
            ? 'md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0'
            : 'lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0',
        )}
      >
        {branches.map((b, i) => (
          <li
            key={b.id}
            data-card
            className={cn('w-[80%] shrink-0 snap-start sm:w-[62%]', count === 2 ? 'md:w-auto' : 'md:w-[46%] lg:w-auto')}
          >
            <BranchCard b={b} index={i} date={date} time={time} />
          </li>
        ))}
      </ul>
      {scrollable && (
        <div
          className={cn('flex items-center justify-center gap-2', count === 2 ? 'md:hidden' : 'lg:hidden')}
          role="tablist"
          aria-label="Chọn chi nhánh"
        >
          {branches.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={b.name}
              onClick={() => goTo(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === active ? 'w-8 bg-court-strong' : 'w-2 bg-line hover:bg-muted/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
