'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { gsap, MOTION_OK, useGSAP } from './gsap';

/** Sơ đồ sân cầu lông (nhìn từ trên) tự "kẻ vạch" khi cuộn tới — dùng trang trí. */
export function CourtDraw({ className, strokeWidth = 2, scrub = false }: { className?: string; strokeWidth?: number; scrub?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const lines = el.querySelectorAll('[data-draw]');
        gsap.from(lines, {
          drawSVG: 0,
          duration: 1.4,
          ease: 'power2.inOut',
          stagger: 0.12,
          scrollTrigger: scrub
            ? { trigger: el, start: 'top 85%', end: 'bottom 40%', scrub: 1 }
            : { trigger: el, start: 'top 85%', once: true },
        });
        gsap.from(el.querySelector('[data-shuttle]'), {
          scale: 0,
          transformOrigin: '50% 50%',
          duration: 0.6,
          ease: 'back.out(3)',
          delay: 1.1,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });
    },
    { scope: ref },
  );
  return (
    <svg ref={ref} viewBox="0 0 268 610" aria-hidden className={cn('overflow-visible', className)}>
      <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="square">
        <rect data-draw x="4" y="4" width="260" height="602" />
        <path data-draw d="M22 4 V606" />
        <path data-draw d="M246 4 V606" />
        <path data-draw d="M4 216 H264" />
        <path data-draw d="M4 394 H264" />
        <path data-draw d="M134 4 V216" />
        <path data-draw d="M134 394 V606" />
        <path data-draw d="M4 40 H264" />
        <path data-draw d="M4 570 H264" />
      </g>
      <path data-draw d="M-14 305 H282" stroke="currentColor" strokeWidth={strokeWidth * 2.5} fill="none" />
      <circle data-shuttle cx="196" cy="140" r="9" fill="#ED1C24" />
    </svg>
  );
}
