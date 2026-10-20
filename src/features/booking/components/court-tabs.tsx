'use client';

import { cn } from '@/lib/cn';

import { type BoardCourt } from './booking-board';

interface CourtTabsProps {
  courts: BoardCourt[];
  selected: string | null;
  freeCounts: Record<string, number> | null;
  onSelect: (courtId: string) => void;
}

export function CourtTabs({ courts, selected, freeCounts, onSelect }: CourtTabsProps) {
  return (
    <div role="radiogroup" aria-label="Chọn sân" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {courts
        .filter((c) => c.status !== 'retired')
        .map((court) => {
          const disabled = court.status !== 'active';
          const active = court.id === selected;
          const free = freeCounts?.[court.id];
          return (
            <button
              key={court.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(court.id)}
              className={cn(
                'flex min-h-14 flex-col items-start justify-center rounded-control border px-3 py-2 text-left transition-colors',
                active ? 'border-court bg-court text-on-court' : 'border-line bg-paper hover:border-ink/50',
                disabled && 'cursor-not-allowed opacity-60 hover:border-line',
              )}
            >
              <span className="font-display text-lg leading-tight">{court.name}</span>
              <span className={cn('text-xs', active ? 'text-ink/75' : 'text-muted')}>
                {disabled ? 'Đang bảo trì' : free === undefined ? 'Đang tải…' : free === 0 ? 'Kín lịch' : `${free} ô trống`}
              </span>
            </button>
          );
        })}
    </div>
  );
}
