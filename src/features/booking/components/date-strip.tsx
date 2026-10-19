'use client';

import { cn } from '@/lib/cn';
import { describeDateKey } from '@/lib/format';

interface DateStripProps {
  days: string[];
  selected: string | null;
  onSelect: (dateKey: string) => void;
}

export function DateStrip({ days, selected, onSelect }: DateStripProps) {
  if (days.length === 0) return <div className="h-[76px] animate-pulse rounded-panel bg-hall" aria-hidden />;
  return (
    <div
      role="radiogroup"
      aria-label="Chọn ngày"
      className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {days.map((day, i) => {
        const info = describeDateKey(day);
        const active = day === selected;
        return (
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(day)}
            className={cn(
              'flex min-h-[72px] min-w-[64px] shrink-0 snap-start flex-col items-center justify-center rounded-control border px-3 transition-colors',
              active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/50',
            )}
          >
            <span className={cn('text-xs', active ? 'text-paper/80' : 'text-muted')}>{i === 0 ? 'Hôm nay' : info.weekdayShort}</span>
            <span className="font-display text-xl tabular">{info.dayMonth}</span>
          </button>
        );
      })}
    </div>
  );
}
