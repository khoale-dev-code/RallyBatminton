/** % thay đổi so với kỳ trước (null khi kỳ trước bằng 0 — không so được). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface Share<K extends string> {
  key: K;
  amount: number;
  /** 0–100, làm tròn */
  percent: number;
}

/** Tỷ trọng từng phần (bỏ phần ≤ 0), sắp lớn → nhỏ. */
export function shares<K extends string>(parts: Partial<Record<K, number>>): Share<K>[] {
  const entries = (Object.entries(parts) as Array<[K, number | undefined]>)
    .map(([key, amount]) => ({ key, amount: amount ?? 0 }))
    .filter((p) => p.amount > 0);
  const total = entries.reduce((n, p) => n + p.amount, 0);
  return entries.sort((a, b) => b.amount - a.amount).map((p) => ({ ...p, percent: total > 0 ? Math.round((p.amount / total) * 100) : 0 }));
}

export interface DayBar {
  day: string;
  booking: number;
  sale: number;
  rental: number;
  refund: number;
}

/** Chiều cao (%) từng phần của cột theo ngày, cùng thang cho cả biểu đồ. */
export function barHeights(series: DayBar[]): {
  max: number;
  bars: Array<DayBar & { total: number; h: { booking: number; sale: number; rental: number } }>;
} {
  const max = Math.max(1, ...series.map((d) => d.booking + d.sale + d.rental));
  return {
    max,
    bars: series.map((d) => ({
      ...d,
      total: d.booking + d.sale + d.rental,
      h: { booking: (d.booking / max) * 100, sale: (d.sale / max) * 100, rental: (d.rental / max) * 100 },
    })),
  };
}

/** Chỉ số ngày cần ghi nhãn dưới trục (đầu, cuối và cách đều ~7 mốc). */
export function tickIndexes(length: number, target = 7): number[] {
  if (length <= 0) return [];
  if (length <= target) return Array.from({ length }, (_, i) => i);
  const step = Math.ceil((length - 1) / (target - 1));
  const out: number[] = [];
  for (let i = 0; i < length; i += step) out.push(i);
  if (out.at(-1) !== length - 1) {
    if (length - 1 - (out.at(-1) ?? 0) < step / 2) out.pop();
    out.push(length - 1);
  }
  return out;
}
