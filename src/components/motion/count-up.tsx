'use client';

import { useRef } from 'react';

import { gsap, MOTION_OK, useGSAP } from './gsap';

const vn = new Intl.NumberFormat('vi-VN');

/** Số đếm lên khi cuộn tới. Máy chủ in sẵn số cuối (SEO, không JS vẫn đúng). */
export function CountUp({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const counter = { v: 0 };
        el.textContent = `0${suffix}`;
        gsap.to(counter, {
          v: value,
          duration: 1.6,
          ease: 'power2.out',
          snap: { v: 1 },
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => {
            el.textContent = `${vn.format(counter.v)}${suffix}`;
          },
        });
        return () => {
          el.textContent = `${vn.format(value)}${suffix}`;
        };
      });
    },
    { scope: ref, dependencies: [value, suffix] },
  );
  return (
    <span ref={ref} className={className}>
      {vn.format(value)}
      {suffix}
    </span>
  );
}
