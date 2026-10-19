import Link from 'next/link';

import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { describeDateKey, formatMinutes, formatTime } from '@/lib/format';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { addDays } from '@/lib/time';

import { plannedMinutes } from '../lib/shift-time';

export interface WeekShift {
  id: string;
  work_date: string;
  scheduled_start: string;
  scheduled_end: string;
  break_minutes: number;
  status: keyof typeof ATTENDANCE_STATUS;
  checked_in_at: string | null;
  checked_out_at: string | null;
  employees: { full_name: string; code: string } | null;
}

/** Lịch tuần: 7 cột trên màn hình rộng, danh sách theo ngày trên điện thoại. */
export function WeekBoard({
  weekStart,
  shifts,
  tz,
  today,
  linkable,
}: {
  weekStart: string;
  shifts: WeekShift[];
  tz: string;
  today: string;
  linkable: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-7">
      {days.map((d) => {
        const info = describeDateKey(d);
        const list = shifts.filter((s) => s.work_date === d);
        return (
          <li
            key={d}
            className={cn('flex min-w-0 flex-col gap-2 rounded-panel border bg-paper p-3', d === today ? 'border-ink' : 'border-line')}
          >
            <p className="flex items-baseline gap-2">
              <span className="font-display text-lg">{info.weekdayShort}</span>
              <span className="text-sm text-muted tabular">{info.dayMonth}</span>
              {d === today && <span className="text-xs font-medium text-court-deep">Hôm nay</span>}
              {/* Ngày trống chỉ chiếm một dòng để danh sách tuần ngắn gọn trên điện thoại. */}
              {list.length === 0 && <span className="ml-auto text-sm text-muted">Trống</span>}
            </p>
            {list.length === 0 ? null : (
              <ul className="flex flex-col gap-2">
                {list.map((s) => {
                  const body = (
                    <>
                      <span className="block leading-snug font-medium">{s.employees?.full_name}</span>
                      <span className="block text-sm tabular">
                        {formatTime(s.scheduled_start, tz)}–{formatTime(s.scheduled_end, tz)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge tone={ATTENDANCE_STATUS[s.status].tone}>{ATTENDANCE_STATUS[s.status].label}</Badge>
                        {s.status === 'scheduled' && s.checked_in_at && <Badge tone="ink">Đang làm</Badge>}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {formatMinutes(plannedMinutes(s.scheduled_start, s.scheduled_end, s.break_minutes))}
                      </span>
                    </>
                  );
                  return (
                    <li key={s.id}>
                      {linkable ? (
                        <Link href={`/admin/shifts/${s.id}`} className="block rounded-control bg-hall/70 p-2 hover:bg-hall">
                          {body}
                        </Link>
                      ) : (
                        <div className="rounded-control bg-hall/70 p-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
