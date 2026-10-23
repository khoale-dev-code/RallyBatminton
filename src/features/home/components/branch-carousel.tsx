/* Rally Home Refresh v1 | Thẻ chi nhánh: lịch và giá từ dữ liệu thực. */
'use client';

import { ArrowRight, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';

import { MediaImage } from '@/components/brand/media-image';
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
  const firstFree = b.slots.find((slot) => slot.freeCourts > 0)?.start;

  return (
    <article className="rally-home-branch-card group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#e2e9e2] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#b3d1ba] hover:shadow-[0_25px_55px_-30px_rgba(12,49,29,0.4)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0d2b23]">
        <Link href={`/branches/${b.slug}`} className="absolute inset-0 block" aria-label={`Xem chi tiết ${b.name}`}>
          {b.coverImagePath ? (
            <MediaImage path={b.coverImagePath} alt={b.name} className="h-full w-full transition-transform duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 390px, (min-width: 640px) 50vw, 90vw" />
          ) : (
            <HallScene title={b.name} showSlogan={false} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
          )}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#03160f]/55 via-transparent to-[#03160f]/10" />
        </Link>
        <span className="pointer-events-none absolute top-4 left-4 rounded-full border border-white/50 bg-white/96 px-3 py-1.5 text-xs font-semibold text-[#13341f] shadow-sm">
          {b.courtCount} sân cầu lông
        </span>
        <span className={cn(
          'pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur',
          b.isOpen ? 'bg-[#b8f55d] text-[#13331c]' : 'bg-white/90 text-[#46504a]',
        )}>
          <span className={cn('size-1.5 rounded-full', b.isOpen ? 'bg-[#237442]' : 'bg-[#8c948f]')} />
          {b.isOpen ? 'Đang mở cửa' : 'Ngoài giờ mở cửa'}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pt-5 pb-5 sm:px-5">
        <div>
          <h3 className="text-[1.75rem] leading-[1.18] font-semibold text-[#14251a]">
            <Link href={`/branches/${b.slug}`} className="transition-colors hover:text-[#197947]">{b.name}</Link>
          </h3>
          <p className="mt-2 flex min-h-6 items-start gap-1.5 text-[0.79rem] leading-5 text-[#68776e]">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{address || 'Xem địa chỉ chi nhánh'}</span>
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-[#edf0eb] pt-4">
          <div>
            <span className="block text-[0.7rem] text-[#6a796f]">Giá tham khảo từ</span>
            {b.minPrice === null ? (
              <strong className="block text-sm font-semibold text-[#196d3f]">Liên hệ chi nhánh</strong>
            ) : (
              <p className="mt-0.5 flex items-baseline gap-1 text-[#163b27]">
                <strong className="font-display text-[1.7rem] leading-none text-[#178644] tabular">{formatVnd(b.minPrice)}</strong>
                <span className="text-xs">/ giờ</span>
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-[#69786d]">
            <Clock3 className="size-3.5" aria-hidden />{shortTime(b.opensAt)} – {shortTime(b.closesAt)}
          </span>
        </div>

        <div className="mt-5">
          <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[0.73rem] font-medium text-[#617468]">
            <span>{b.slotsIsToday ? 'Giờ gợi ý hôm nay' : 'Giờ gợi ý ngày mai'}</span>
            <span>Chọn giờ để đặt <span aria-hidden>↘</span></span>
          </p>
          {b.slots.length > 0 ? (
            <ul className="grid grid-cols-4 gap-1.5">
              {b.slots.map((slot) => {
                const unavailable = slot.freeCourts === 0;
                return (
                  <li key={slot.start}>
                    {unavailable ? (
                      <span title="Hết sân" className="flex min-h-10 items-center justify-center rounded-lg border border-dashed border-[#e5e9e4] bg-[#f5f6f4] text-xs text-[#a2aba4] line-through tabular">
                        {slot.start}
                      </span>
                    ) : (
                      <Link
                        href={slotHref(b, slot.start)}
                        title={`Còn ${slot.freeCourts} sân`}
                        className={cn(
                          'flex min-h-10 items-center justify-center rounded-lg border text-xs font-semibold tabular transition-colors focus-visible:ring-2 focus-visible:ring-[#168346]',
                          slot.start === firstFree
                            ? 'border-[#9bdaa7] bg-[#e5f5e3] text-[#196d3d] hover:bg-[#d4f0d5]'
                            : 'border-[#e3e9e2] bg-white text-[#354d3a] hover:border-[#9bdaa7] hover:bg-[#eaf8e8]',
                        )}
                      >
                        {slot.start}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-10 items-center rounded-lg bg-[#f4f6f3] px-3 text-xs text-[#68786d]">
              Chọn ngày để kiểm tra lịch trống
            </div>
          )}
        </div>

        <Link href={slotHref(b, firstFree)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#167e40] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#105e30]">
          Xem lịch & đặt sân <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** Vuốt thẻ trên mobile hoặc dùng phím/nút điều hướng khi cần. */
export function BranchCarousel({ branches, heading, action }: { branches: HomeBranch[]; heading: ReactNode; action?: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (direction: -1 | 1) => {
    const node = track.current;
    if (!node) return;
    const first = node.querySelector('li');
    const spacing = parseFloat(getComputedStyle(node).columnGap || '16') || 16;
    node.scrollBy({ left: direction * ((first?.getBoundingClientRect().width ?? node.clientWidth) + spacing), behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        {heading}
        <div className="flex items-center gap-2">
          {action}
          {branches.length > 3 && (
            <div className="hidden items-center gap-2 sm:flex">
              <button type="button" onClick={() => scroll(-1)} aria-label="Xem chi nhánh phía trước" className="grid size-11 place-items-center rounded-full border border-[#dce7dc] bg-white text-[#1c4f30] hover:bg-[#eff7ed]">
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Xem chi nhánh tiếp theo" className="grid size-11 place-items-center rounded-full border border-[#dce7dc] bg-white text-[#1c4f30] hover:bg-[#eff7ed]">
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
      <ul ref={track} className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:scroll-px-0 sm:px-0 lg:gap-5">
        {branches.map((branch) => (
          <li key={branch.id} className="w-[min(88vw,25rem)] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2.5rem)/3)]">
            <BranchCard b={branch} />
          </li>
        ))}
      </ul>
      <Link href="/branches" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#176f40] sm:hidden">
        Xem tất cả chi nhánh <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
