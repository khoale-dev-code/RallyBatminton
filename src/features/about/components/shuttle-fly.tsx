'use client';

import { useRef } from 'react';

import { gsap, MOTION_OK, useGSAP } from '@/components/motion/gsap';
import { cn } from '@/lib/cn';

/** Quả cầu bay vòng cung qua khung khi cuộn (scrub), xoay theo đường bay. */
export function ShuttleFly({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: ref.current, start: 'top 85%', end: 'bottom 15%', scrub: 1.2 },
          defaults: { ease: 'none' },
        });
        tl.fromTo('[data-shuttle]', { xPercent: 0, left: '0%' }, { left: '100%', xPercent: -100, duration: 1 }, 0)
          .fromTo('[data-shuttle]', { y: 60 }, { y: -40, duration: 0.5, ease: 'sine.out' }, 0)
          .to('[data-shuttle]', { y: 50, duration: 0.5, ease: 'sine.in' }, 0.5)
          .fromTo('[data-shuttle]', { rotate: -35 }, { rotate: 55, duration: 1 }, 0);
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} aria-hidden className={cn('relative h-28 overflow-hidden', className)}>
      <svg data-shuttle viewBox="0 0 64 64" className="absolute top-1/2 left-0 size-14 -translate-y-1/2">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-ink">
          <path d="M18 40 L6 12 M25 38 L22 6 M32 38 L38 6 M38 40 L52 12 M6 12 Q29 2 52 12" />
          <path d="M13 28 Q29 22 45 28" strokeWidth="1.4" opacity="0.6" />
        </g>
        <circle cx="28" cy="48" r="9" fill="#ED1C24" />
      </svg>
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-line" />
    </div>
  );
}
