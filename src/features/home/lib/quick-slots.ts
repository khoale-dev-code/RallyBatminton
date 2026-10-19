import { addDays, dateKeyInZone, minutesToTime, timeToMinutes, zonedParts, zonedToUtc } from '@/lib/time';

export interface BusyRange {
  courtId: string;
  start: Date;
  end: Date;
}

export interface QuickSlot {
  /** 'HH:MM' giờ bắt đầu (giờ địa phương). */
  start: string;
  /** Số sân còn trống trong 1 giờ từ `start`. */
  freeCourts: number;
}

/** Phút đóng cửa: '00:00' nghĩa là nửa đêm (1440). */
export function closeMinutes(closesAt: string): number {
  const m = timeToMinutes(closesAt);
  return m === 0 ? 1440 : m;
}

/** Đang mở cửa tại thời điểm `now` (giờ địa phương của chi nhánh). */
export function isOpenAt(opensAt: string, closesAt: string, now: Date, tz: string): boolean {
  const p = zonedParts(now, tz);
  const minute = p.hour * 60 + p.minute;
  return minute >= timeToMinutes(opensAt) && minute < closeMinutes(closesAt);
}

/**
 * Ngày và các giờ bắt đầu (tròn giờ) nên gợi ý: còn giờ hôm nay thì lấy từ giờ kế tiếp,
 * hết giờ thì chuyển sang ngày mai từ giờ mở cửa.
 */
export function candidateStarts(
  opensAt: string,
  closesAt: string,
  now: Date,
  tz: string,
  count = 4,
): { dateKey: string; starts: number[] } {
  const open = timeToMinutes(opensAt);
  const close = closeMinutes(closesAt);
  const today = dateKeyInZone(now, tz);
  const p = zonedParts(now, tz);
  const nowMinute = p.hour * 60 + p.minute;
  const first = Math.max(Math.ceil(open / 60) * 60, Math.ceil((nowMinute + 1) / 60) * 60);
  const build = (from: number) => {
    const starts: number[] = [];
    for (let m = from; m + 60 <= close && starts.length < count; m += 60) starts.push(m);
    return starts;
  };
  const todayStarts = build(first);
  if (todayStarts.length > 0) return { dateKey: today, starts: todayStarts };
  return { dateKey: addDays(today, 1), starts: build(Math.ceil(open / 60) * 60) };
}

/** Số sân trống cho từng giờ bắt đầu, dựa trên các khoảng đã có người giữ/đặt. */
export function quickSlots(dateKey: string, starts: number[], courtCount: number, busy: BusyRange[], tz: string): QuickSlot[] {
  return starts.map((m) => {
    const start = minutesToTime(m);
    const from = zonedToUtc(dateKey, start, tz).getTime();
    const to = from + 60 * 60000;
    const taken = new Set(busy.filter((b) => b.start.getTime() < to && b.end.getTime() > from).map((b) => b.courtId));
    return { start, freeCourts: Math.max(0, courtCount - taken.size) };
  });
}
