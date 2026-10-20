/** Tăng ca: các phép tính dùng chung giữa giao diện và kiểm thử (khớp 18_overtime.sql). */

export type OvertimeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export const OVERTIME_STATUS: Record<OvertimeStatus, { label: string; tone: 'amber' | 'green' | 'red' | 'neutral' }> = {
  pending: { label: 'Chờ nhân viên đồng ý', tone: 'amber' },
  accepted: { label: 'Đã đồng ý', tone: 'green' },
  declined: { label: 'Nhân viên từ chối', tone: 'red' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
};

export function isOvertimeStatus(value: string): value is OvertimeStatus {
  return value in OVERTIME_STATUS;
}

/** Lựa chọn thời gian tăng ca (phút). */
export const OVERTIME_MINUTES = [30, 60, 90, 120, 150, 180, 240, 300, 360] as const;

/** Mức tối thiểu theo Bộ luật Lao động 2019, Điều 98: ngày thường 150%, ngày nghỉ hằng tuần 200%, lễ tết 300%. */
export const OVERTIME_MULTIPLIERS = [
  { value: 1.5, label: 'Ngày thường (150%)' },
  { value: 2, label: 'Ngày nghỉ hằng tuần (200%)' },
  { value: 3, label: 'Ngày lễ, tết (300%)' },
] as const;

interface PayRate {
  pay_type: string;
  hourly_rate: number | null;
  daily_rate: number | null;
  standard_day_minutes?: number | null;
}

/** Lương giờ quy đổi: lương giờ, hoặc lương ngày ÷ số giờ công chuẩn. */
export function baseHourlyRate(rate: PayRate | null | undefined): number | null {
  if (!rate) return null;
  if (rate.pay_type === 'hourly') return rate.hourly_rate ?? null;
  if (rate.daily_rate === null || rate.daily_rate === undefined) return null;
  const minutes = rate.standard_day_minutes && rate.standard_day_minutes > 0 ? rate.standard_day_minutes : 480;
  return Math.round((rate.daily_rate * 60) / minutes);
}

/** Giá tăng ca gợi ý = lương giờ × hệ số, làm tròn lên nghìn đồng. */
export function suggestedOvertimeRate(baseHourly: number | null, multiplier = 1.5): number | null {
  if (baseHourly === null || baseHourly <= 0) return null;
  return Math.ceil((baseHourly * multiplier) / 1000) * 1000;
}

/**
 * Phút tăng ca thực làm: phần sau giờ ra ca theo lịch (từ lúc vào nếu vào muộn hơn),
 * tối đa bằng số phút đã đồng ý và tổng công của ca.
 */
export function overtimeWorkedMinutes(input: {
  checkedIn: string | null;
  checkedOut: string | null;
  scheduledEnd: string;
  approvedMinutes: number | null;
  paidMinutes: number | null;
}): number {
  const { checkedIn, checkedOut, scheduledEnd, approvedMinutes, paidMinutes } = input;
  if (!checkedIn || !checkedOut || !approvedMinutes || approvedMinutes <= 0) return 0;
  const from = Math.max(new Date(scheduledEnd).getTime(), new Date(checkedIn).getTime());
  const after = Math.floor((new Date(checkedOut).getTime() - from) / 60000);
  return Math.max(0, Math.min(approvedMinutes, paidMinutes ?? 0, after));
}

export function overtimePay(minutes: number, hourlyRate: number): number {
  return Math.round((hourlyRate * minutes) / 60);
}

/** Giờ kết thúc khung tăng ca. */
export function overtimeEndsAt(scheduledEnd: string, minutes: number): Date {
  return new Date(new Date(scheduledEnd).getTime() + minutes * 60000);
}
