'use client';

import { ArrowRight, Clock3, MapPin, Navigation, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { gsap, MOTION_OK, useGSAP } from '@/components/motion/gsap';
import { buttonClass } from '@/components/ui/button';
import { bookingHref } from '@/features/booking/lib/links';
import { cn } from '@/lib/cn';
import { formatPhone, formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

import { type AboutBranch } from '../queries';

/** Bản đồ Google từng chi nhánh: chọn chi nhánh → bản đồ đổi (mờ dần), thẻ địa chỉ trượt vào. */
export function BranchMapExplorer({ branches }: { branches: AboutBranch[] }) {
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const b = branches[index] ?? branches[0];

  const { contextSafe } = useGSAP({ scope: root });

  const select = contextSafe((i: number) => {
    if (i === index) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setIndex(i);
      return;
    }
    gsap.to('[data-map-stage]', {
      autoAlpha: 0,
      scale: 0.985,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => setIndex(i),
    });
  });

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo('[data-map-stage]', { autoAlpha: 0, scale: 0.985 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
        gsap.from('[data-map-card]', { x: -30, autoAlpha: 0, duration: 0.6, ease: 'power3.out', delay: 0.1 });
      });
    },
    { scope: root, dependencies: [index], revertOnUpdate: true },
  );

  if (!b) return null;

  return (
    <div ref={root} className="flex flex-col gap-4">
      {branches.length > 1 && (
        <div
          role="tablist"
          aria-label="Chọn chi nhánh trên bản đồ"
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {branches.map((br, i) => (
            <button
              key={br.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => select(i)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                i === index ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/40',
              )}
            >
              <MapPin className={cn('size-4', i === index ? 'text-court' : 'text-muted')} aria-hidden />
              {br.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-hall">
        <div data-map-stage className="aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-[21/9]">
          <iframe
            key={b.id}
            title={`Bản đồ ${b.name}`}
            src={b.mapSrc}
            className="h-full w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <div
          data-map-card
          className="pointer-events-auto absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-[1.1rem] bg-paper/95 p-4 shadow-lift ring-1 ring-black/5 backdrop-blur sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:w-80 sm:p-5"
        >
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-court-strong uppercase">
              Chi nhánh {String(index + 1).padStart(2, '0')}
            </p>
            <p className="font-display text-2xl leading-tight">{b.name}</p>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-shuttle" aria-hidden />
              <span>{b.address}</span>
            </li>
            <li className="flex items-center gap-2 text-muted">
              <Clock3 className="size-4 shrink-0" aria-hidden />
              <span className="tabular">
                {shortTime(b.opensAt)}–{shortTime(b.closesAt)}
              </span>
              <span>· {b.courtCount} sân</span>
              {b.minPrice !== null && <span className="hidden sm:inline">· từ {formatVnd(b.minPrice)}</span>}
            </li>
            {b.phone && (
              <li>
                <a href={`tel:${b.phone}`} className="inline-flex items-center gap-2 text-muted hover:text-ink">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {formatPhone(b.phone)}
                </a>
              </li>
            )}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <a href={b.directionsHref} target="_blank" rel="noopener noreferrer" className={buttonClass('outline', 'sm', 'w-full')}>
              <Navigation className="size-4" aria-hidden />
              Chỉ đường
            </a>
            <Link href={bookingHref(b.slug)} className={buttonClass('brand', 'sm', 'w-full')}>
              Đặt sân
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
