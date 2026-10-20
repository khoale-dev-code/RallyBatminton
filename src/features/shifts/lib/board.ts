/** Trạng thái thời gian của một ca — dùng cho lịch tuần và dải "Đang trong ca". */

export type ShiftPhase = 'live' | 'upcoming' | 'done' | 'off';

interface PhaseInput {
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  overtimeMinutes?: number;
}

/**
 * - live: đã vào ca và chưa ra, hoặc đang trong giờ theo lịch (kể cả tăng ca đã đồng ý);
 * - done: đã ra ca / đã có mặt, hoặc giờ đã qua;
 * - off: vắng, nghỉ phép, hủy.
 */
export function shiftPhase(s: PhaseInput, now: number): ShiftPhase {
  if (s.status === 'absent' || s.status === 'leave' || s.status === 'cancelled') return 'off';
  if (s.checked_in_at && !s.checked_out_at) return 'live';
  if (s.status === 'present' || s.checked_out_at) return 'done';
  const start = new Date(s.scheduled_start).getTime();
  const end = new Date(s.scheduled_end).getTime() + (s.overtimeMinutes ?? 0) * 60000;
  if (now < start) return 'upcoming';
  if (now < end) return 'live';
  return 'done';
}

/** "HH:MM" từ số phút trong ngày (cho phép > 24 giờ với ca qua nửa đêm). Không dùng Intl để server/trình duyệt khớp nhau. */
export function clockFromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 450 → "7g30", 300 → "5g". */
export function shortDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return m === 0 ? `${h}g` : `${h}g${String(m).padStart(2, '0')}`;
}
