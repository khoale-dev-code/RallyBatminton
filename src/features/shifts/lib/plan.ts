/** Lập kế hoạch xếp ca: nhiều nhân viên × nhiều ngày, phát hiện trùng ca. Dùng chung cho xem trước và Server Action. */
import { addDays, isoWeekday, timeToMinutes } from '@/lib/time';

import { shiftWindow } from './shift-time';

export const MAX_PLAN_DAYS = 31;
export const MAX_PLAN_EMPLOYEES = 10;
export const MAX_PLAN_ROWS = 120;
export const BREAK_OPTIONS = [0, 15, 30, 45, 60, 90, 120] as const;

/** Mẫu ca có sẵn; thêm các khung giờ đang dùng nhiều nhất ở chi nhánh. */
export const DEFAULT_TEMPLATES = [
  { start: '06:00', end: '14:00', label: 'Ca sáng' },
  { start: '14:00', end: '22:00', label: 'Ca chiều' },
  { start: '17:00', end: '22:00', label: 'Ca tối' },
] as const;

export interface ShiftTemplate {
  start: string;
  end: string;
  label: string;
}

/** Các ngày trong khoảng [from, to] thuộc thứ đã chọn (1 = T2 … 7 = CN), tối đa MAX_PLAN_DAYS ngày. */
export function expandDates(from: string, to: string, weekdays: number[]): string[] {
  if (!from || !to || to < from) return [];
  const allowed = new Set(weekdays);
  const out: string[] = [];
  for (let d = from, i = 0; d <= to && i < MAX_PLAN_DAYS; d = addDays(d, 1), i += 1) {
    if (allowed.has(isoWeekday(d))) out.push(d);
  }
  return out;
}

/** Số ngày giữa hai ngày (tính cả hai đầu). */
export function spanDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export interface ExistingShift {
  employeeId: string;
  start: string;
  end: string;
}

export interface PlannedShift {
  employeeId: string;
  workDate: string;
  startsAt: Date;
  endsAt: Date;
  /** Trùng với ca đã có của nhân viên này (sẽ bỏ qua). */
  conflict: boolean;
}

export interface PlanResult {
  items: PlannedShift[];
  minutes: number;
  paidMinutes: number;
  overnight: boolean;
  error: string | null;
}

/** Kiểm tra khung giờ và tạo danh sách ca; đánh dấu ca trùng với ca đã có (cùng nhân viên, chồng giờ). */
export function buildPlan(input: {
  employeeIds: string[];
  dates: string[];
  start: string;
  end: string;
  breakMinutes: number;
  tz: string;
  existing: ExistingShift[];
}): PlanResult {
  const { employeeIds, dates, start, end, breakMinutes, tz, existing } = input;
  const empty = { items: [], minutes: 0, paidMinutes: 0, overnight: false };
  if (start === end) return { ...empty, error: 'Giờ ra phải khác giờ vào.' };
  const overnight = timeToMinutes(end) <= timeToMinutes(start);
  const minutes = (timeToMinutes(end) - timeToMinutes(start) + (overnight ? 1440 : 0)) % 1440 || 1440;
  if (minutes > 16 * 60) return { ...empty, overnight, minutes, error: 'Ca tối đa 16 giờ.' };
  if (breakMinutes >= minutes) return { ...empty, overnight, minutes, error: 'Giờ nghỉ phải ngắn hơn ca.' };
  if (employeeIds.length > MAX_PLAN_EMPLOYEES)
    return { ...empty, overnight, minutes, error: `Tối đa ${MAX_PLAN_EMPLOYEES} nhân viên mỗi lần.` };
  if (employeeIds.length * dates.length > MAX_PLAN_ROWS) {
    return { ...empty, overnight, minutes, error: `Tối đa ${MAX_PLAN_ROWS} ca mỗi lần — chia nhỏ khoảng ngày.` };
  }

  const ranges = existing.map((e) => ({ id: e.employeeId, a: new Date(e.start).getTime(), b: new Date(e.end).getTime() }));
  const items: PlannedShift[] = [];
  for (const date of dates) {
    const w = shiftWindow(date, start, end, tz);
    const a = w.startsAt.getTime();
    const b = w.endsAt.getTime();
    for (const employeeId of employeeIds) {
      const conflict = ranges.some((r) => r.id === employeeId && r.a < b && a < r.b);
      items.push({ employeeId, workDate: date, startsAt: w.startsAt, endsAt: w.endsAt, conflict });
      // Ca vừa thêm cũng chặn ca sau chồng lên (vd. ca qua đêm + ca sáng hôm sau).
      if (!conflict) ranges.push({ id: employeeId, a, b });
    }
  }
  return { items, minutes, paidMinutes: minutes - breakMinutes, overnight, error: null };
}

/** Mẫu ca: mặc định + khung giờ hay dùng nhất trong dữ liệu (không trùng mẫu mặc định), tối đa 6 mẫu. */
export function templatesFrom(used: Array<{ start: string; end: string }>): ShiftTemplate[] {
  const counts = new Map<string, number>();
  for (const u of used) counts.set(`${u.start}-${u.end}`, (counts.get(`${u.start}-${u.end}`) ?? 0) + 1);
  const defaults = new Set(DEFAULT_TEMPLATES.map((t) => `${t.start}-${t.end}`));
  const frequent = [...counts.entries()]
    .filter(([key]) => !defaults.has(key))
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([key]) => {
      const [start = '', end = ''] = key.split('-');
      return { start, end, label: 'Hay dùng' };
    });
  return [...frequent, ...DEFAULT_TEMPLATES];
}
