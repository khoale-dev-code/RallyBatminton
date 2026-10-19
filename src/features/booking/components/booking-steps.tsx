'use client';

import { Check } from 'lucide-react';
import { useRef } from 'react';

import { gsap, MOTION_OK, useGSAP } from '@/components/motion/gsap';
import { cn } from '@/lib/cn';

const STEPS = ['Chọn chi nhánh', 'Chọn sân & giờ', 'Giữ chỗ'];

/** Thanh 3 bước của trang Đặt sân; vạch tiến trình chạy tới bước hiện tại. */
export function BookingSteps({ current }: { current: 0 | 1 | 2 }) {
  const ref = useRef<HTMLOListElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from('[data-fill]', { scaleX: 0, transformOrigin: '0% 50%', duration: 0.9, ease: 'power3.inOut', stagger: 0.25 });
        gsap.from('[data-dot]', { scale: 0.4, autoAlpha: 0, duration: 0.5, ease: 'back.out(2.5)', stagger: 0.15 });
      });
    },
    { scope: ref },
  );
  return (
    <ol ref={ref} className="grid grid-cols-3 gap-2" aria-label="Các bước đặt sân">
      {STEPS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className="flex flex-col gap-2" aria-current={now ? 'step' : undefined}>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-line">
              {(done || now) && <span data-fill className={cn('absolute inset-0 rounded-full', done ? 'bg-court-strong' : 'bg-ink')} />}
            </span>
            <span className="flex items-center gap-2">
              <span
                data-dot
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  done ? 'bg-court-strong text-paper' : now ? 'bg-ink text-paper' : 'border border-line text-muted',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={cn('text-xs leading-tight sm:text-sm', now ? 'font-semibold' : done ? 'text-court-deep' : 'text-muted')}>
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
