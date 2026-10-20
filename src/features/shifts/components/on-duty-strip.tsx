import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';

import { shiftPhase } from '../lib/board';
import { employeeColor } from '../lib/calendar';
import { type WeekShift } from './week-calendar';

function acceptedOvertime(s: WeekShift): number {
  return s.shift_overtime?.find((o) => o.status === 'accepted')?.minutes ?? 0;
}

/** Dải "Đang trong ca" phía trên lịch: ai đang làm tới mấy giờ, ai đến giờ mà chưa vào ca. */
export function OnDutyStrip({ shifts, tz, now }: { shifts: WeekShift[]; tz: string; now: number }) {
  const live = shifts.filter((s) => shiftPhase({ ...s, overtimeMinutes: acceptedOvertime(s) }, now) === 'live');
  if (live.length === 0) return null;
  return (
    <section
      aria-label="Đang trong ca"
      className="mb-4 flex flex-col gap-2 rounded-panel border border-court/60 bg-court-soft px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
    >
      <p className="flex shrink-0 items-center gap-2 text-sm font-medium text-court-deep">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-court opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-court" />
        </span>
        Đang trong ca ({live.length})
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {live.map((s) => {
          const ot = acceptedOvertime(s);
          const end = new Date(new Date(s.scheduled_end).getTime() + ot * 60000);
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm',
                !s.checked_in_at && 'ring-1 ring-shuttle/50',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: employeeColor(s.employees?.code ?? s.employees?.full_name ?? s.id) }}
                aria-hidden
              />
              <span className="font-medium">{s.employees?.full_name}</span>
              <span className="text-muted tabular">
                đến {formatTime(end, tz)}
                {ot > 0 && ' (tăng ca)'}
                {!s.checked_in_at && <span className="text-shuttle-deep"> · chưa vào ca</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
