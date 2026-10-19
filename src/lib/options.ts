import { minutesToTime } from './time';

/** Các mốc 30 phút: 00:00 … 23:30 (+ 24:00 nếu cho phép). */
export function halfHourOptions(includeEnd = false): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const last = includeEnd ? 48 : 47;
  for (let i = 0; i <= last; i += 1) {
    const t = minutesToTime(i * 30);
    out.push({ value: t, label: t });
  }
  return out;
}

export const WEEKDAY_OPTIONS = [
  { value: '1', label: 'T2' },
  { value: '2', label: 'T3' },
  { value: '3', label: 'T4' },
  { value: '4', label: 'T5' },
  { value: '5', label: 'T6' },
  { value: '6', label: 'T7' },
  { value: '7', label: 'CN' },
];
