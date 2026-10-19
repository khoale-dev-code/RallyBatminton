import { addDays, timeToMinutes, zonedToUtc } from '@/lib/time';

export interface ShiftWindow {
  startsAt: Date;
  endsAt: Date;
  overnight: boolean;
  minutes: number;
}

/** Giờ kết thúc ≤ giờ bắt đầu nghĩa là ca qua nửa đêm (kết thúc ngày hôm sau). */
export function shiftWindow(dateKey: string, start: string, end: string, tz: string): ShiftWindow {
  const overnight = timeToMinutes(end) <= timeToMinutes(start);
  const startsAt = zonedToUtc(dateKey, start, tz);
  const endsAt = zonedToUtc(overnight ? addDays(dateKey, 1) : dateKey, end, tz);
  return { startsAt, endsAt, overnight, minutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000) };
}

/** Phút công dự kiến (trừ giờ nghỉ). */
export function plannedMinutes(startsAt: string | Date, endsAt: string | Date, breakMinutes: number): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(ms / 60000) - breakMinutes);
}

/** Ghép ngày + giờ địa phương từ ô datetime-local ("2026-10-17T18:30") về UTC. */
export function localInputToUtc(value: string, tz: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!m || !m[1] || !m[2]) return null;
  return zonedToUtc(m[1], m[2], tz);
}
