'use client';

import { type ReactNode } from 'react';

import { useCountdown } from '@/hooks/use-countdown';
import { useTilt } from '@/hooks/use-tilt';
import { cn } from '@/lib/cn';

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useTilt<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('[transform-style:preserve-3d]', className)}>
      {children}
    </div>
  );
}

export function Countdown({ until, className, expiredLabel = 'Đã hết hạn' }: { until: string; className?: string; expiredLabel?: string }) {
  const seconds = useCountdown(until);
  if (seconds <= 0) return <span className={className}>{expiredLabel}</span>;
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return (
    <span className={cn('tabular', className)} role="timer" aria-live="off">
      {mm}:{ss}
    </span>
  );
}
