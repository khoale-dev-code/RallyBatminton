import { minutesToTime, timeToMinutes, zonedToUtc } from '@/lib/time';

export interface DaySlot {
  index: number;
  start: string; // 'HH:mm'
  end: string; // 'HH:mm' (có thể '24:00')
  startMinutes: number;
}

/** Các ô thời gian trong ngày theo giờ mở cửa. */
export function buildDaySlots(opensAt: string, closesAt: string, slotMinutes: number): DaySlot[] {
  const open = timeToMinutes(opensAt);
  const close = timeToMinutes(closesAt);
  const slots: DaySlot[] = [];
  for (let m = open, i = 0; m + slotMinutes <= close; m += slotMinutes, i += 1) {
    slots.push({ index: i, start: minutesToTime(m), end: minutesToTime(m + slotMinutes), startMinutes: m });
  }
  return slots;
}

export interface BusyRange {
  courtId: string;
  start: number; // epoch ms
  end: number;
}

export interface SlotWindow {
  start: number;
  end: number;
}

export function slotWindow(dateKey: string, slot: DaySlot, tz: string): SlotWindow {
  return { start: zonedToUtc(dateKey, slot.start, tz).getTime(), end: zonedToUtc(dateKey, slot.end, tz).getTime() };
}

export function overlaps(a: SlotWindow, b: SlotWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isBusy(busy: BusyRange[], courtId: string, window: SlotWindow): boolean {
  return busy.some((b) => b.courtId === courtId && overlaps(b, window));
}

export interface Selection {
  courtId: string;
  startIndex: number;
  endIndex: number; // bao gồm
}

interface SelectionRules {
  slotCount: number;
  minSlots: number;
  maxSlots: number;
  /** true nếu ô không chọn được (đã bận / đã qua giờ) */
  isBlocked: (index: number) => boolean;
}

function rangeFree(from: number, to: number, rules: SelectionRules): boolean {
  if (from < 0 || to >= rules.slotCount) return false;
  for (let i = from; i <= to; i += 1) if (rules.isBlocked(i)) return false;
  return true;
}

/**
 * Chạm 1 lần: chọn từ ô đó đủ thời lượng tối thiểu (nếu trống).
 * Chạm ô sau: kéo dài tới ô đó (nếu liền mạch & không quá tối đa).
 * Chạm ô đầu của vùng chọn: bỏ chọn. Chạm ô bên trong: rút ngắn tới ô đó.
 */
export function nextSelection(current: Selection | null, courtId: string, index: number, rules: SelectionRules): Selection | null {
  if (rules.isBlocked(index)) return current;
  const startFresh = (): Selection => {
    const end = index + rules.minSlots - 1;
    return rangeFree(index, end, rules) ? { courtId, startIndex: index, endIndex: end } : { courtId, startIndex: index, endIndex: index };
  };
  if (!current || current.courtId !== courtId || index < current.startIndex) return startFresh();
  if (index === current.startIndex) return null;
  if (index <= current.endIndex) return { ...current, endIndex: index };
  const length = index - current.startIndex + 1;
  if (length <= rules.maxSlots && rangeFree(current.startIndex, index, rules)) return { ...current, endIndex: index };
  return startFresh();
}

export function selectionLength(selection: Selection): number {
  return selection.endIndex - selection.startIndex + 1;
}
