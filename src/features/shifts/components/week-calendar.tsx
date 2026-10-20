'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { cn } from '@/lib/cn';
import { describeDateKey } from '@/lib/format';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { addDays, zonedToUtc } from '@/lib/time';

import { clockFromMinutes, shiftPhase, shortDuration, type ShiftPhase } from '../lib/board';
import { employeeColor, hourRange, layoutDay } from '../lib/calendar';

export interface WeekShift {
  id: string;
  work_date: string;
  scheduled_start: string;
  scheduled_end: string;
  break_minutes: number;
  status: keyof typeof ATTENDANCE_STATUS;
  checked_in_at: string | null;
  checked_out_at: string | null;
  employees: { id?: string; full_name: string; code: string } | null;
  shift_overtime?: Array<{ id: string; minutes: number; status: string }>;
}

interface CalendarEvent {
  shift: WeekShift;
  startMin: number;
  endMin: number;
  /** Phút tăng ca đang hiệu lực (đã đồng ý hoặc chờ đồng ý). */
  otMin: number;
  otAccepted: boolean;
  color: string;
  employeeKey: string;
}

const HOUR_DESKTOP = 48;
const HOUR_MOBILE = 56;

function toEvents(shifts: WeekShift[], tz: string): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  const midnight = new Map<string, number>();
  for (const s of shifts) {
    let base = midnight.get(s.work_date);
    if (base === undefined) {
      base = zonedToUtc(s.work_date, '00:00', tz).getTime();
      midnight.set(s.work_date, base);
    }
    const ot = s.shift_overtime?.find((o) => o.status === 'accepted' || o.status === 'pending');
    const key = s.employees?.code ?? s.employees?.full_name ?? s.id;
    const event: CalendarEvent = {
      shift: s,
      startMin: Math.round((new Date(s.scheduled_start).getTime() - base) / 60000),
      endMin: Math.round((new Date(s.scheduled_end).getTime() - base) / 60000),
      otMin: ot?.minutes ?? 0,
      otAccepted: ot?.status === 'accepted',
      color: employeeColor(key),
      employeeKey: key,
    };
    const list = byDay.get(s.work_date);
    if (list) list.push(event);
    else byDay.set(s.work_date, [event]);
  }
  return byDay;
}

function phaseOf(e: CalendarEvent, now: number): ShiftPhase {
  return shiftPhase({ ...e.shift, overtimeMinutes: e.otAccepted ? e.otMin : 0 }, now);
}

function statusText(e: CalendarEvent, phase: ShiftPhase): { text: string; tone: 'live' | 'alert' | 'muted' | 'ok' } | null {
  const s = e.shift;
  if (phase === 'live') return s.checked_in_at ? { text: 'Đang làm', tone: 'live' } : { text: 'Chưa vào ca', tone: 'alert' };
  if (phase === 'off') return { text: ATTENDANCE_STATUS[s.status].label, tone: 'muted' };
  if (s.status === 'present') return { text: 'Có mặt', tone: 'ok' };
  if (phase === 'done') return { text: 'Chưa chấm công', tone: 'alert' };
  return null;
}

/** Ô ca trên lưới giờ: vị trí theo giờ, ca trùng giờ đứng cạnh nhau; ca đang làm tô xanh đặc. */
function EventBlock({
  e,
  lane,
  lanes,
  rangeStart,
  hourPx,
  now,
  linkable,
  dimmed,
  narrow,
}: {
  narrow: boolean;
  e: CalendarEvent;
  lane: number;
  lanes: number;
  rangeStart: number;
  hourPx: number;
  now: number;
  linkable: boolean;
  dimmed: boolean;
}) {
  const phase = phaseOf(e, now);
  const status = statusText(e, phase);
  const clippedEnd = Math.min(e.endMin, 1440);
  const top = ((e.startMin - rangeStart * 60) / 60) * hourPx;
  const height = Math.max(22, ((clippedEnd - e.startMin) / 60) * hourPx - 2);
  const compact = height < 46;
  const liveIn = phase === 'live' && Boolean(e.shift.checked_in_at);
  const liveMissing = phase === 'live' && !e.shift.checked_in_at;
  const fullName = e.shift.employees?.full_name ?? 'Nhân viên';
  // Cột hẹp (ca trùng giờ trong lưới tuần): chỉ hiện tên gọi (chữ cuối) như "Huy", "Hân".
  const name = narrow ? (fullName.trim().split(/\s+/).pop() ?? fullName) : fullName;
  const timeLabel = `${clockFromMinutes(e.startMin)}–${clockFromMinutes(e.endMin)}`;
  const position: CSSProperties = {
    top,
    height,
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
  };
  const palette: CSSProperties = liveIn
    ? {}
    : liveMissing
      ? {}
      : phase === 'off'
        ? {}
        : { backgroundColor: `color-mix(in srgb, ${e.color} 13%, white)`, borderLeftColor: e.color };

  const body = (
    <>
      {narrow && !compact ? (
        <>
          <span className="flex items-center gap-1 leading-tight font-semibold">
            {liveIn && <span className="size-1.5 shrink-0 rounded-full bg-paper" aria-hidden />}
            <span className="truncate">{name}</span>
          </span>
          <span className={cn('block truncate tabular', liveIn ? 'text-paper/85' : 'text-muted')}>{clockFromMinutes(e.startMin)}</span>
          {status && height >= 64 && (
            <span
              className={cn(
                'block truncate font-medium',
                status.tone === 'live' && 'text-paper',
                status.tone === 'alert' && 'text-shuttle-deep',
                status.tone === 'ok' && 'text-court-deep',
                status.tone === 'muted' && 'text-muted',
              )}
            >
              {status.tone === 'alert' && e.shift.status === 'scheduled' && phase === 'live' ? 'Chưa vào' : status.text}
            </span>
          )}
        </>
      ) : compact ? (
        <span className="block truncate leading-tight">
          <span className="font-semibold">{name}</span>
          <span className={cn('ml-1 tabular', liveIn ? 'text-paper/85' : 'text-muted')}>{clockFromMinutes(e.startMin)}</span>
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1 leading-tight font-semibold">
            {liveIn && (
              <span className="relative flex size-1.5 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-paper opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-paper" />
              </span>
            )}
            <span className="line-clamp-2 break-words">{name}</span>
          </span>
          <span className={cn('mt-0.5 block tabular', liveIn ? 'text-paper/85' : 'text-muted')}>
            {timeLabel}
            {e.endMin > 1440 && ' (hôm sau)'}
          </span>
          {status && height >= 64 && (
            <span
              className={cn(
                'mt-0.5 block font-medium',
                status.tone === 'live' && 'text-paper',
                status.tone === 'alert' && 'text-shuttle-deep',
                status.tone === 'ok' && 'text-court-deep',
                status.tone === 'muted' && 'text-muted',
              )}
            >
              {status.text}
            </span>
          )}
        </>
      )}
    </>
  );

  const className = cn(
    'absolute z-[1] overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-[11px] text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-[opacity,box-shadow] sm:text-xs',
    'hover:z-[3] hover:shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] focus-visible:z-[3] focus-visible:outline-2 focus-visible:outline-ink',
    liveIn && 'z-[2] border-l-court-deep bg-court-strong text-paper shadow-[0_8px_20px_-10px_var(--color-court-deep)]',
    liveMissing && 'z-[2] border-l-shuttle bg-shuttle-soft ring-1 ring-shuttle/40',
    phase === 'off' && 'border-l-line bg-hall text-muted line-through decoration-muted/60',
    phase === 'done' && 'opacity-60',
    dimmed && 'opacity-20',
    narrow && 'px-1 text-[10px] sm:text-[11px]',
  );
  const title = `${fullName} · ${timeLabel}${status ? ` · ${status.text}` : ''}${e.otMin ? ` · ${e.otAccepted ? 'tăng ca' : 'chờ đồng ý tăng ca'} +${shortDuration(e.otMin)}` : ''}`;

  return (
    <>
      {linkable ? (
        <Link href={`/admin/shifts/${e.shift.id}`} prefetch={false} className={className} style={{ ...position, ...palette }} title={title}>
          {body}
        </Link>
      ) : (
        <div className={className} style={{ ...position, ...palette }} title={title}>
          {body}
        </div>
      )}
      {e.otMin > 0 && clippedEnd < 1440 && (
        <div
          className={cn(
            'pointer-events-none absolute z-[1] overflow-hidden rounded-b-md border border-t-0 border-dashed px-1.5 pt-0.5 text-[10px] leading-tight font-medium',
            e.otAccepted ? 'border-court-deep/60 text-court-deep' : 'border-amber-deep/60 text-amber-deep',
            dimmed && 'opacity-20',
          )}
          style={{
            top: top + height,
            height: Math.max(14, (Math.min(e.otMin, 1440 - clippedEnd) / 60) * hourPx - 2),
            left: position.left,
            width: position.width,
            backgroundImage: `repeating-linear-gradient(135deg, ${e.otAccepted ? 'rgb(98 187 70 / 0.16)' : 'rgb(122 82 0 / 0.1)'} 0 6px, transparent 6px 12px)`,
          }}
          aria-hidden
        >
          {e.otAccepted ? `+${shortDuration(e.otMin)} tăng ca` : 'Chờ đồng ý TC'}
        </div>
      )}
    </>
  );
}

/** Một cột ngày trên lưới giờ (dùng cho cả tuần trên máy tính và một ngày trên điện thoại). */
function DayColumn({
  events,
  range,
  hourPx,
  now,
  nowMinute,
  linkable,
  focus,
  past,
  week = false,
  onPick,
}: {
  /** Bấm vào chỗ trống: trả về phút trong ngày tại vị trí bấm. */
  onPick?: (minute: number) => void;
  /** Lưới 7 ngày: cột hẹp nên ca trùng giờ hiện gọn. */
  week?: boolean;
  events: CalendarEvent[];
  range: [number, number];
  hourPx: number;
  now: number;
  /** Phút hiện tại trong ngày nếu cột này là hôm nay. */
  nowMinute: number | null;
  linkable: boolean;
  focus: string | null;
  past: boolean;
}) {
  const placed = useMemo(
    () => layoutDay(events.map((e) => ({ id: e.shift.id, startMin: e.startMin, endMin: Math.min(1440, e.endMin + e.otMin) }))),
    [events],
  );
  const [start, end] = range;
  const showNow = nowMinute !== null && nowMinute >= start * 60 && nowMinute <= end * 60;
  return (
    <div
      className={cn('relative border-l border-line', past && 'bg-hall/50', onPick && 'cursor-pointer hover:bg-court-soft/40')}
      title={onPick ? 'Bấm vào chỗ trống để xếp ca vào giờ này' : undefined}
      onClick={
        onPick
          ? (ev) => {
              if (ev.target !== ev.currentTarget) return;
              const y = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
              onPick(Math.max(0, Math.min(1410, start * 60 + Math.floor((y / hourPx) * 2) * 30)));
            }
          : undefined
      }
      style={{
        height: (end - start) * hourPx,
        backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
        backgroundSize: `100% ${hourPx}px`,
      }}
    >
      {events.map((e) => {
        const p = placed.get(e.shift.id);
        return (
          <EventBlock
            key={e.shift.id}
            e={e}
            lane={p?.lane ?? 0}
            lanes={p?.lanes ?? 1}
            rangeStart={start}
            hourPx={hourPx}
            now={now}
            linkable={linkable}
            dimmed={focus !== null && e.employeeKey !== focus}
            narrow={week && (p?.lanes ?? 1) > 1}
          />
        );
      })}
      {showNow && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-shuttle"
          style={{ top: ((nowMinute - start * 60) / 60) * hourPx }}
          aria-hidden
        >
          <span className="absolute -top-[5px] -left-[6px] size-3 rounded-full bg-shuttle" />
        </div>
      )}
    </div>
  );
}

function HourGutter({ range, hourPx }: { range: [number, number]; hourPx: number }) {
  const hours = Array.from({ length: range[1] - range[0] }, (_, i) => range[0] + i);
  return (
    <div className="relative" style={{ height: (range[1] - range[0]) * hourPx }} aria-hidden>
      {hours.map((h, i) => (
        <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular" style={{ top: i * hourPx }}>
          {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
        </span>
      ))}
    </div>
  );
}

function DayHead({ dateKey, today, count, compact }: { dateKey: string; today: string; count: number; compact?: boolean }) {
  const info = describeDateKey(dateKey);
  const isToday = dateKey === today;
  const day = Number(dateKey.slice(8, 10));
  return (
    <span className="flex flex-col items-center gap-0.5 py-1.5">
      <span className={cn('text-[11px] font-medium tracking-wide uppercase', isToday ? 'text-court-deep' : 'text-muted')}>
        {info.weekdayShort}
      </span>
      <span
        className={cn(
          'grid place-items-center rounded-full font-display tabular',
          compact ? 'size-8 text-base' : 'size-10 text-xl',
          isToday ? 'bg-court-strong text-paper' : dateKey < today ? 'text-muted' : 'text-ink',
        )}
      >
        {day}
      </span>
      {!compact && <span className="text-[11px] text-muted">{count === 0 ? 'Trống' : `${count} ca`}</span>}
      {compact && <span className={cn('size-1 rounded-full', count > 0 ? 'bg-ink/60' : 'bg-transparent')} aria-hidden />}
    </span>
  );
}

function minuteOfDay(nowMs: number, dateKey: string, tz: string): number {
  return Math.floor((nowMs - zonedToUtc(dateKey, '00:00', tz).getTime()) / 60000);
}

/**
 * Lịch ca dạng Google Calendar: cột giờ bên trái, mỗi ngày một cột, ô ca đặt đúng giờ,
 * vạch đỏ giờ hiện tại. Điện thoại: chọn ngày ở dải trên, xem một ngày đầy đủ.
 */
export function WeekCalendar({
  weekStart,
  shifts,
  tz,
  today,
  nowMs,
  linkable,
  onPickSlot,
}: {
  weekStart: string;
  shifts: WeekShift[];
  tz: string;
  today: string;
  nowMs: number;
  linkable: boolean;
  /** Bấm ô trống để xếp ca (chỉ chủ sân). */
  onPickSlot?: (dateKey: string, minute: number) => void;
}) {
  // Giờ hiện tại: lấy từ máy chủ lúc tải (khớp khi hydrate), sau đó tự chạy mỗi 30 giây.
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => toEvents(shifts, tz), [shifts, tz]);
  const range = useMemo(
    () => hourRange([...byDay.values()].flat().map((e) => ({ id: e.shift.id, startMin: e.startMin, endMin: e.endMin + e.otMin }))),
    [byDay],
  );
  const inWeek = today >= weekStart && today < addDays(weekStart, 7);
  const [selected, setSelected] = useState(inWeek ? today : weekStart);
  const [focus, setFocus] = useState<string | null>(null);
  const nowMinute = inWeek ? minuteOfDay(now, today, tz) : null;

  const people = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string; count: number }>();
    for (const e of [...byDay.values()].flat()) {
      const item = map.get(e.employeeKey);
      if (item) item.count += 1;
      else map.set(e.employeeKey, { key: e.employeeKey, name: e.shift.employees?.full_name ?? '—', color: e.color, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [byDay]);

  const selectedEvents = byDay.get(selected) ?? [];
  const selectedInfo = describeDateKey(selected);

  return (
    <div className="flex flex-col gap-3">
      {people.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Nhân viên trong tuần — bấm để làm nổi bật">
          {people.map((p) => {
            const active = focus === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(active ? null : p.key)}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                  active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
                  focus !== null && !active && 'opacity-60',
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                {p.name}
                <span className={cn('tabular', active ? 'text-paper/70' : 'text-muted')}>{p.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Máy tính bảng / máy tính: lưới tuần. */}
      <div className="hidden overflow-clip rounded-panel border border-line bg-paper md:block">
        <div className="sticky top-0 z-[5] grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-line bg-paper/95 backdrop-blur">
          <span className="self-end pb-1.5 pl-1 text-[10px] text-muted">GMT+7</span>
          {days.map((d) => (
            <span key={d} className="border-l border-line">
              <DayHead dateKey={d} today={today} count={byDay.get(d)?.length ?? 0} />
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] pt-2 pb-3">
          <HourGutter range={range} hourPx={HOUR_DESKTOP} />
          {days.map((d) => (
            <DayColumn
              key={d}
              events={byDay.get(d) ?? []}
              range={range}
              hourPx={HOUR_DESKTOP}
              now={now}
              nowMinute={d === today ? nowMinute : null}
              linkable={linkable}
              focus={focus}
              past={d < today}
              week
              onPick={onPickSlot && d >= today ? (m) => onPickSlot(d, m) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Điện thoại: dải chọn ngày + một ngày. */}
      <div className="md:hidden">
        <div className="sticky top-14 z-[5] -mx-4 grid grid-cols-7 border-b border-line bg-paper/95 px-2 backdrop-blur sm:-mx-6">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={selected === d}
              aria-label={`${describeDateKey(d).weekdayLong} ${describeDateKey(d).dayMonth}, ${byDay.get(d)?.length ?? 0} ca`}
              className={cn(
                'rounded-control',
                selected === d && d !== today && '[&_span.font-display]:bg-ink [&_span.font-display]:text-paper',
              )}
            >
              <DayHead dateKey={d} today={today} count={byDay.get(d)?.length ?? 0} compact />
            </button>
          ))}
        </div>
        <p className="mt-3 mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {selectedInfo.weekdayLong}, {selectedInfo.dayMonth}
            {selected === today && <span className="ml-2 text-court-deep">Hôm nay</span>}
          </span>
          <span className="text-muted">{selectedEvents.length === 0 ? 'Không có ca' : `${selectedEvents.length} ca`}</span>
        </p>
        {(selectedEvents.length > 0 || (onPickSlot && selected >= today)) && (
          <div className="grid grid-cols-[3rem_minmax(0,1fr)] rounded-panel border border-line bg-paper pt-2 pr-1 pb-3">
            <HourGutter range={range} hourPx={HOUR_MOBILE} />
            <DayColumn
              events={selectedEvents}
              range={range}
              hourPx={HOUR_MOBILE}
              now={now}
              nowMinute={selected === today ? nowMinute : null}
              linkable={linkable}
              focus={focus}
              past={selected < today}
              onPick={onPickSlot && selected >= today ? (m) => onPickSlot(selected, m) : undefined}
            />
          </div>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-court-strong" aria-hidden />
          Đang làm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-shuttle-soft ring-1 ring-shuttle/50" aria-hidden />
          Đến giờ mà chưa vào ca
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-court-deep/60" aria-hidden />
          Tăng ca
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-shuttle" aria-hidden />
          Giờ hiện tại
        </span>
      </p>
    </div>
  );
}
