import { describeDateKey, formatMinutes, formatTime } from '@/lib/format';
import { BOOKING_STATUS, type Tone } from '@/lib/labels';
import { dateKeyInZone, DEFAULT_TZ } from '@/lib/time';

/** Các mốc hành trình một đơn đặt sân đi qua (theo thứ tự). */
export const BOOKING_STEPS = [
  { status: 'held', label: 'Giữ chỗ' },
  { status: 'confirmed', label: 'Xác nhận' },
  { status: 'checked_in', label: 'Đến sân' },
  { status: 'completed', label: 'Hoàn tất' },
] as const;

export type StoppedStatus = 'cancelled' | 'expired' | 'no_show';

export type BookingJourney = { kind: 'progress'; reached: number } | { kind: 'stopped'; status: StoppedStatus };

const STOPPED: readonly StoppedStatus[] = ['cancelled', 'expired', 'no_show'];

/** Đơn đang ở mốc nào; đơn hủy / hết hạn / không đến thì dừng hành trình. */
export function bookingJourney(status: string): BookingJourney {
  const stopped = STOPPED.find((s) => s === status);
  if (stopped) return { kind: 'stopped', status: stopped };
  const reached = BOOKING_STEPS.findIndex((s) => s.status === status);
  return { kind: 'progress', reached: Math.max(reached, 0) };
}

export interface BookingWhen {
  weekday: string;
  dayMonth: string;
  year: string;
  timeRange: string;
  duration: string;
}

/** Ngày, giờ và thời lượng chơi theo giờ chi nhánh. */
export function bookingWhen(startsAt: string, endsAt: string, tz: string = DEFAULT_TZ): BookingWhen {
  const start = new Date(startsAt);
  const dateKey = dateKeyInZone(start, tz);
  const day = describeDateKey(dateKey);
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - start.getTime()) / 60000));
  return {
    weekday: day.weekdayLong,
    dayMonth: day.dayMonth,
    year: dateKey.slice(0, 4),
    timeRange: `${formatTime(startsAt, tz)} – ${formatTime(endsAt, tz)}`,
    duration: formatMinutes(minutes),
  };
}

export interface PaymentProgress {
  percent: number;
  remaining: number;
  settled: boolean;
}

/** Đã trả bao nhiêu phần trăm tổng tiền (giới hạn 0–100). */
export function paymentProgress(total: number, paid: number): PaymentProgress {
  if (total <= 0) return { percent: paid > 0 ? 100 : 0, remaining: 0, settled: true };
  const percent = Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
  return { percent, remaining: Math.max(0, total - paid), settled: paid >= total };
}

/** Khách tự hủy được khi đơn còn giữ chỗ / đã xác nhận và chưa tới giờ chơi. */
export function canGuestCancel(status: string, startsAt: string, nowMs: number): boolean {
  return (status === 'held' || status === 'confirmed') && new Date(startsAt).getTime() > nowMs;
}

/** Liên kết chỉ đường Google Maps theo địa chỉ chi nhánh. */
export function directionsUrl(branchName: string, address: string | undefined): string {
  const query = [branchName, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Nhãn + màu trạng thái đơn (an toàn với giá trị lạ từ database). */
export function bookingStatusInfo(status: string): { label: string; tone: Tone } {
  const entry = Object.entries(BOOKING_STATUS).find(([key]) => key === status);
  return entry ? entry[1] : { label: status, tone: 'neutral' };
}
