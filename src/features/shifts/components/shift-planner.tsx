'use client';

import { CalendarPlus, Check, Moon, TriangleAlert, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { describeDateKey } from '@/lib/format';
import { WEEKDAY_OPTIONS } from '@/lib/options';
import { addDays, minutesToTime, timeToMinutes } from '@/lib/time';

import { createShiftsAction } from '../actions';
import { shortDuration } from '../lib/board';
import { employeeColor } from '../lib/calendar';
import { BREAK_OPTIONS, buildPlan, expandDates, spanDays, type PlannedShift, type ShiftTemplate } from '../lib/plan';
import { WeekCalendar, type WeekShift } from './week-calendar';

export interface PlannerEmployee {
  id: string;
  code: string;
  full_name: string;
  homeHere: boolean;
  hasRate: boolean;
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => minutesToTime(i * 30)).map((t) => ({ value: t, label: t }));

function addHours(time: string, hours: number): string {
  return minutesToTime((timeToMinutes(time) + hours * 60) % 1440);
}

function dayLabel(dateKey: string): string {
  const d = describeDateKey(dateKey);
  return `${d.weekdayShort} ${d.dayMonth}`;
}

/** Nút chọn dạng "chip" có trạng thái bật/tắt. */
function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        active ? 'border-primary bg-primary text-paper' : 'border-line bg-paper hover:border-primary/50 hover:text-primary',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2 font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-paper">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Lịch ca + bảng xếp ca: chọn nhiều nhân viên, khung giờ (mẫu có sẵn), khoảng ngày và thứ trong tuần,
 * xem trước từng ca (báo trùng) trước khi lưu. Bấm vào ô trống trên lịch để mở sẵn ngày giờ đó.
 */
export function ShiftPlanner({
  branchId,
  tz,
  weekStart,
  today,
  nowMs,
  shifts,
  employees,
  templates,
  canEdit,
}: {
  branchId: string;
  tz: string;
  weekStart: string;
  today: string;
  nowMs: number;
  shifts: WeekShift[];
  employees: PlannerEmployee[];
  templates: ShiftTemplate[];
  canEdit: boolean;
}) {
  const inWeek = today >= weekStart && today < addDays(weekStart, 7);
  const firstDay = inWeek ? today : weekStart;
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const [start, setStart] = useState(templates[0]?.start ?? '06:00');
  const [end, setEnd] = useState(templates[0]?.end ?? '14:00');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(firstDay);
  const [weekdays, setWeekdays] = useState<number[]>(ALL_DAYS);

  const here = employees.filter((e) => e.homeHere);
  const others = employees.filter((e) => !e.homeHere);
  const visibleOthers = showOthers ? others : others.filter((e) => picked.includes(e.id));
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const span = spanDays(from, to);
  const dates = useMemo(() => expandDates(from, to, span > 1 ? weekdays : ALL_DAYS), [from, to, span, weekdays]);
  const existing = useMemo(
    () =>
      shifts
        .filter((s) => s.status !== 'cancelled' && s.employees?.id)
        .map((s) => ({ employeeId: s.employees?.id ?? '', start: s.scheduled_start, end: s.scheduled_end })),
    [shifts],
  );
  const plan = useMemo(
    () => buildPlan({ employeeIds: picked, dates, start, end, breakMinutes, tz, existing }),
    [picked, dates, start, end, breakMinutes, tz, existing],
  );
  const ok = plan.items.filter((i) => !i.conflict);
  const conflicts = plan.items.length - ok.length;
  const missingRate = picked.filter((id) => byId.get(id)?.hasRate === false);

  const toggleEmployee = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleWeekday = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  const quickRange = (kind: 'one' | 'week' | 'weekdays' | 'weekend') => {
    if (kind === 'one') {
      setTo(from);
      return;
    }
    setFrom(weekStart < today && inWeek ? today : weekStart);
    setTo(addDays(weekStart, 6));
    setWeekdays(kind === 'week' ? ALL_DAYS : kind === 'weekdays' ? [1, 2, 3, 4, 5] : [6, 7]);
  };

  const openAt = (dateKey: string, minute: number) => {
    const startTime = minutesToTime(Math.floor(minute / 30) * 30);
    setStart(startTime);
    setEnd(addHours(startTime, 8));
    setFrom(dateKey);
    setTo(dateKey);
    setOpen(true);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlannedShift[]>();
    for (const item of plan.items) {
      const list = map.get(item.workDate);
      if (list) list.push(item);
      else map.set(item.workDate, [item]);
    }
    return [...map.entries()];
  }, [plan.items]);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !open && (
        <div>
          <Button variant="primary" onClick={() => setOpen(true)} className="gap-2">
            <CalendarPlus className="size-4" aria-hidden />
            Xếp ca mới
          </Button>
          <span className="ml-3 hidden text-sm text-muted md:inline">hoặc bấm vào ô trống trên lịch để xếp vào giờ đó</span>
        </div>
      )}

      {canEdit && open && (
        <section
          ref={panelRef}
          aria-label="Xếp ca mới"
          className="scroll-mt-20 rounded-panel border border-ink/15 bg-paper shadow-[0_18px_40px_-28px_rgb(0_0_0/0.45)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 text-lg">
              <CalendarPlus className="size-5" aria-hidden />
              Xếp ca mới
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-hall hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <ActionForm action={createShiftsAction} onSuccess={() => setPicked([])} className="gap-0">
            <input type="hidden" name="branch_id" value={branchId} />
            <input type="hidden" name="start" value={start} />
            <input type="hidden" name="end" value={end} />
            <input type="hidden" name="break_minutes" value={breakMinutes} />
            {picked.map((id) => (
              <input key={id} type="hidden" name="employee_ids" value={id} />
            ))}
            {dates.map((d) => (
              <input key={d} type="hidden" name="dates" value={d} />
            ))}
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
              <div className="flex min-w-0 flex-col gap-7">
                <Step n={1} title="Ai làm?">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Nhân viên chi nhánh này">
                    {here.map((e) => (
                      <Chip key={e.id} active={picked.includes(e.id)} onClick={() => toggleEmployee(e.id)}>
                        {picked.includes(e.id) ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: employeeColor(e.code) }} aria-hidden />
                        )}
                        {e.full_name}
                        {!e.hasRate && <span className="text-xs text-amber-deep">· chưa có lương</span>}
                      </Chip>
                    ))}
                    {visibleOthers.map((e) => (
                      <Chip key={e.id} active={picked.includes(e.id)} onClick={() => toggleEmployee(e.id)} className="border-dashed">
                        {picked.includes(e.id) && <Check className="size-4" aria-hidden />}
                        {e.full_name}
                        <span className={cn('text-xs', picked.includes(e.id) ? 'text-paper/70' : 'text-muted')}>chi nhánh khác</span>
                      </Chip>
                    ))}
                    {others.length > 0 && !showOthers && (
                      <button
                        type="button"
                        onClick={() => setShowOthers(true)}
                        className="min-h-10 px-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
                      >
                        + {others.length} người chi nhánh khác
                      </button>
                    )}
                  </div>
                  {employees.length === 0 && <p className="text-sm text-muted">Chưa có nhân viên đang làm việc — thêm ở mục Nhân viên.</p>}
                </Step>

                <Step n={2} title="Giờ làm">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Mẫu ca">
                    {templates.map((t) => (
                      <Chip
                        key={`${t.start}-${t.end}`}
                        active={start === t.start && end === t.end}
                        onClick={() => {
                          setStart(t.start);
                          setEnd(t.end);
                        }}
                      >
                        <span className="font-medium">{t.label}</span>
                        <span className="tabular opacity-80">
                          {t.start}–{t.end}
                        </span>
                      </Chip>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <SelectField
                      name="_start"
                      label="Vào ca"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      options={TIME_OPTIONS}
                    />
                    <SelectField name="_end" label="Ra ca" value={end} onChange={(e) => setEnd(e.target.value)} options={TIME_OPTIONS} />
                    <SelectField
                      wrapperClassName="col-span-2 sm:col-span-1"
                      name="_break"
                      label="Nghỉ giữa ca"
                      value={String(breakMinutes)}
                      onChange={(e) => setBreakMinutes(Number(e.target.value))}
                      options={BREAK_OPTIONS.map((m) => ({ value: String(m), label: m === 0 ? 'Không' : `${m} phút` }))}
                    />
                  </div>
                  <p className={cn('flex flex-wrap items-center gap-x-2 text-sm', plan.error ? 'text-shuttle-deep' : 'text-muted')}>
                    {plan.error ?? (
                      <>
                        <span>
                          Ca dài <strong className="text-ink">{shortDuration(plan.minutes)}</strong>
                          {breakMinutes > 0 && <> · công {shortDuration(plan.paidMinutes)}</>}
                        </span>
                        {plan.overnight && (
                          <span className="inline-flex items-center gap-1 text-ink">
                            <Moon className="size-3.5" aria-hidden />
                            qua nửa đêm, ra ca ngày hôm sau
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </Step>

                <Step n={3} title="Ngày nào?">
                  <div className="flex flex-wrap gap-2">
                    <Chip active={span === 1} onClick={() => quickRange('one')}>
                      Chỉ 1 ngày
                    </Chip>
                    <Chip active={span > 1 && weekdays.length === 7} onClick={() => quickRange('week')}>
                      Cả tuần
                    </Chip>
                    <Chip active={span > 1 && weekdays.join() === '1,2,3,4,5'} onClick={() => quickRange('weekdays')}>
                      T2–T6
                    </Chip>
                    <Chip active={span > 1 && weekdays.join() === '6,7'} onClick={() => quickRange('weekend')}>
                      Cuối tuần
                    </Chip>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      name="_from"
                      label="Từ ngày"
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        if (e.target.value > to) setTo(e.target.value);
                      }}
                    />
                    <TextField
                      name="_to"
                      label="Đến ngày"
                      type="date"
                      value={to}
                      min={from}
                      max={addDays(from, 30)}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                  {span > 1 && (
                    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Lặp vào các thứ">
                      {WEEKDAY_OPTIONS.map((w) => {
                        const d = Number(w.value);
                        const active = weekdays.includes(d);
                        return (
                          <button
                            key={w.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleWeekday(d)}
                            className={cn(
                              'min-h-10 rounded-control border text-sm font-medium',
                              active
                                ? 'border-primary bg-primary text-paper'
                                : 'border-line bg-paper text-muted hover:border-primary/50 hover:text-primary',
                            )}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Step>

                <TextField name="note" label="Ghi chú" optional maxLength={300} placeholder="Trực quầy, giải đấu cuối tuần…" />
              </div>

              <aside className="flex min-w-0 flex-col gap-3 rounded-control bg-hall/70 p-4 lg:sticky lg:top-4 lg:self-start">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">Xem trước</span>
                  <span className="text-sm text-muted">
                    {picked.length} người × {dates.length} ngày
                  </span>
                </p>
                {plan.items.length === 0 ? (
                  <p className="text-sm text-muted">
                    {picked.length === 0 ? 'Chọn nhân viên để xem các ca sẽ xếp.' : dates.length === 0 ? 'Chọn ít nhất một ngày.' : ''}
                  </p>
                ) : (
                  <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 text-sm">
                    {grouped.map(([date, items]) => (
                      <li key={date} className="rounded-control bg-paper px-3 py-2">
                        <p className="flex justify-between gap-2 font-medium">
                          {dayLabel(date)}
                          <span className="font-normal text-muted tabular">
                            {start}–{end}
                          </span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          {items.map((i) => (
                            <span
                              key={i.employeeId}
                              className={cn(i.conflict && 'text-shuttle-deep line-through')}
                              title={i.conflict ? 'Trùng ca — sẽ bỏ qua' : undefined}
                            >
                              {byId.get(i.employeeId)?.full_name ?? ''}
                            </span>
                          ))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {conflicts > 0 && (
                  <p className="flex items-start gap-1.5 text-sm text-shuttle-deep">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {ok.length === 0
                      ? 'Tất cả ca đều trùng giờ với ca đã có của nhân viên — đổi giờ hoặc ngày.'
                      : `${conflicts} ca trùng giờ với ca đã có — sẽ bỏ qua, các ca còn lại vẫn được xếp.`}
                  </p>
                )}
                {missingRate.length > 0 && (
                  <p className="flex items-start gap-1.5 text-sm text-amber-deep">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {missingRate.map((id) => byId.get(id)?.full_name).join(', ')} chưa có mức lương — nhớ thêm trước khi chốt lương.
                  </p>
                )}
                {ok.length > 0 && !plan.error && (
                  <p className="text-sm text-muted">
                    Tổng <strong className="text-ink">{shortDuration(ok.length * plan.paidMinutes)}</strong> công. Trùng với ca ở chi nhánh
                    khác được kiểm tra khi lưu.
                  </p>
                )}
                <SubmitButton disabled={ok.length === 0 || Boolean(plan.error)} pendingLabel="Đang xếp ca…" className="w-full">
                  {ok.length > 0 ? `Xếp ${ok.length} ca` : 'Xếp ca'}
                </SubmitButton>
              </aside>
            </div>
          </ActionForm>
        </section>
      )}

      <WeekCalendar
        weekStart={weekStart}
        shifts={shifts}
        tz={tz}
        today={today}
        nowMs={nowMs}
        linkable={canEdit}
        onPickSlot={canEdit ? openAt : undefined}
      />
    </div>
  );
}
