import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';

import { type RentalLiveState } from '../lib/rental-status';

function sameDay(a: string, b: string): boolean {
  return formatDate(a) === formatDate(b);
}

const BAR: Record<RentalLiveState['phase'], string> = {
  ok: 'bg-court',
  soon: 'bg-amber-deep/70',
  grace: 'bg-amber-deep/70',
  late: 'bg-shuttle',
};

export const PHASE_TEXT: Record<RentalLiveState['phase'], string> = {
  ok: 'text-court-deep',
  soon: 'text-amber-deep',
  grace: 'text-amber-deep',
  late: 'text-shuttle-deep',
};

/** Thanh thời gian thuê: giờ giao → giờ hẹn trả, tiến độ và trạng thái (còn / trễ). */
export function RentalTimeMeter({
  startsAt,
  dueAt,
  state,
  className,
}: {
  startsAt: string;
  dueAt: string;
  state: RentalLiveState;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className={cn('font-medium whitespace-nowrap', PHASE_TEXT[state.phase])}>{state.label}</span>
        <span className="whitespace-nowrap text-muted tabular">
          {sameDay(startsAt, dueAt) ? formatTime(startsAt) : `${formatDate(startsAt).slice(0, 5)} ${formatTime(startsAt)}`} →{' '}
          {formatTime(dueAt)}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-hall"
        role="progressbar"
        aria-label="Thời gian thuê đã dùng"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(state.progress * 100)}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', BAR[state.phase])}
          style={{ width: `${Math.max(4, Math.round(state.progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
