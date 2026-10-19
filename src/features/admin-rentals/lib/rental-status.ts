import { computeOvertime, formatSpan, rentalProgress, type OvertimePolicy, type OvertimeResult } from '@/lib/rental-fee';

export type RentalPhase = 'ok' | 'soon' | 'grace' | 'late';

export interface RentalLiveState {
  phase: RentalPhase;
  /** Phút còn lại tới hạn trả (âm khi đã quá hạn). */
  minutesLeft: number;
  progress: number;
  overtime: OvertimeResult;
  /** "Còn 25 phút", "Trễ 5 phút · trong ân hạn", "Trễ 1 giờ 5 phút". */
  label: string;
}

const SOON_MINUTES = 15;

/** Trạng thái sống của một phiếu thuê tại thời điểm `now` (hàm thuần, dùng chung bảng & chi tiết). */
export function rentalLiveState(
  input: { startsAt: string; dueAt: string; quantity: number; policy: OvertimePolicy },
  now: number,
): RentalLiveState {
  const due = new Date(input.dueAt);
  const minutesLeft = Math.ceil((due.getTime() - now) / 60000);
  const overtime = computeOvertime(due, now, input.quantity, input.policy);
  const progress = rentalProgress(input.startsAt, due, now);
  if (minutesLeft > 0) {
    return {
      phase: minutesLeft <= SOON_MINUTES ? 'soon' : 'ok',
      minutesLeft,
      progress,
      overtime,
      label: `Còn ${formatSpan(minutesLeft)}`,
    };
  }
  if (overtime.fee === 0) {
    return {
      phase: 'grace',
      minutesLeft,
      progress,
      overtime,
      label: overtime.lateMinutes === 0 ? 'Đến hạn trả' : `Trễ ${formatSpan(overtime.lateMinutes)} · trong ân hạn`,
    };
  }
  return { phase: 'late', minutesLeft, progress, overtime, label: `Trễ ${formatSpan(overtime.lateMinutes)}` };
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1) ?? '?';
  return last.charAt(0).toLocaleUpperCase('vi');
}
