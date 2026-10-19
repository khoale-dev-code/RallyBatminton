'use client';

import { useRef, type ReactNode } from 'react';

import { gsap, MOTION_OK, useGSAP } from './gsap';

/** Lớp con data-parallax trôi chậm hơn khi cuộn (cảm giác chiều sâu). */
export function Parallax({ children, className, amount = 18 }: { children: ReactNode; className?: string; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((layer) => {
          gsap.fromTo(
            layer,
            { yPercent: -amount / 2 },
            {
              yPercent: amount / 2,
              ease: 'none',
              scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );
        });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
