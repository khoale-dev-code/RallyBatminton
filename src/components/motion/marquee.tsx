'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { gsap, MOTION_OK, useGSAP } from './gsap';

/** Dải chữ chạy ngang vô tận; chậm lại khi rê chuột. */
export function Marquee({ items, className, speed = 40 }: { items: string[]; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const track = ref.current?.querySelector<HTMLElement>('[data-track]');
      if (!track) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: speed, repeat: -1 });
        const slow = () => gsap.to(tween, { timeScale: 0.25, duration: 0.6 });
        const normal = () => gsap.to(tween, { timeScale: 1, duration: 0.6 });
        const root = ref.current;
        root?.addEventListener('mouseenter', slow);
        root?.addEventListener('mouseleave', normal);
        return () => {
          root?.removeEventListener('mouseenter', slow);
          root?.removeEventListener('mouseleave', normal);
        };
      });
    },
    { scope: ref },
  );
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className="flex items-center">
          <span className="px-6 whitespace-nowrap">{t}</span>
          <span aria-hidden className="size-2.5 rounded-full bg-shuttle" />
        </span>
      ))}
    </div>
  );
  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <div data-track className="flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
