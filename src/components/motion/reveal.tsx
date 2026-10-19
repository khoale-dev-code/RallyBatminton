'use client';

import { useRef, type ReactNode } from 'react';

import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from './gsap';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Khoảng trượt lên (px) khi xuất hiện. */
  y?: number;
  stagger?: number;
}

/**
 * Các phần tử con có thuộc tính data-reveal hiện dần khi cuộn tới (theo lô, có so le).
 * Không có JavaScript hoặc bật giảm chuyển động → nội dung hiện bình thường.
 */
export function Reveal({ children, className, y = 36, stagger = 0.09 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]');
        if (items.length === 0) return;
        gsap.set(items, { autoAlpha: 0, y });
        ScrollTrigger.batch(items, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger, overwrite: true }),
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
