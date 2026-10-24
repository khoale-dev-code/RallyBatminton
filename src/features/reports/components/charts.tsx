import { type ReactNode } from 'react';

import { tickIndexes } from '@/features/dashboard/lib/metrics';
import { cn } from '@/lib/cn';
import { formatVnd, formatVndShort } from '@/lib/format';

import { heatGrid, heatLevel, occupancyPct, WEEKDAY_LONG, WEEKDAY_SHORT, type HeatCell, type RevenueBar } from '../lib/report';

/** Biểu đồ của báo cáo: HTML/CSS thuần (hiện được khi tắt JS, in được), rê chuột / chạm để xem số. */

export const SOURCE_VIZ = {
  booking: { label: 'Tiền sân', color: 'var(--viz-booking)' },
  sale: { label: 'Bán hàng', color: 'var(--viz-sale)' },
  rental: { label: 'Cho thuê', color: 'var(--viz-rental)' },
} as const;
export type SourceKey = keyof typeof SOURCE_VIZ;
const SOURCE_KEYS: SourceKey[] = ['booking', 'sale', 'rental'];

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Ô thông tin hiện khi rê chuột / focus vào một cột. */
function Tip({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'left' | 'right' }) {
  return (
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-56 rounded-control bg-ink px-2.5 py-1.5 text-left text-xs leading-snug text-paper shadow-lg group-focus-within:block group-hover:block',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'left' && 'left-0',
        align === 'right' && 'right-0',
      )}
    >
      {children}
    </span>
  );
}

/** Cột chồng Tiền sân / Bán hàng / Cho thuê theo ngày, tuần hoặc tháng. */
export function RevenueBars({ bars }: { bars: RevenueBar[] }) {
  const totals = bars.map((b) => b.booking + b.sale + b.rental);
  const max = Math.max(1, ...totals);
  const ticks = new Set(tickIndexes(bars.length));
  const dense = bars.length > 40;
  return (
    <figure className="flex flex-col gap-3">
      <Legend items={SOURCE_KEYS.map((k) => SOURCE_VIZ[k])} />
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
          {[max, max / 2, 0].map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-right text-[0.65rem] text-muted tabular">{v > 0 ? formatVndShort(v) : '0'}</span>
              <span className="h-px flex-1 border-t border-dashed border-line" />
            </div>
          ))}
        </div>
        <ol
          className={cn('relative ml-12 flex h-52 items-end sm:h-60', dense ? 'gap-px' : 'gap-0.5 sm:gap-1')}
          aria-label="Thực thu theo thời gian"
        >
          {bars.map((b, i) => {
            const total = totals[i] ?? 0;
            const align = i < bars.length / 5 ? 'left' : i > (bars.length * 4) / 5 ? 'right' : 'center';
            return (
              <li key={b.key} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none">
                <span className="sr-only">
                  {b.title}: {formatVnd(total)}
                </span>
                <span
                  aria-hidden
                  className="flex w-full flex-col gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 2 : 0 }}
                >
                  {(['rental', 'sale', 'booking'] as const).map((k) =>
                    b[k] > 0 ? <span key={k} className="basis-0" style={{ flexGrow: b[k], background: SOURCE_VIZ[k].color }} /> : null,
                  )}
                </span>
                <Tip align={align}>
                  <span className="block font-medium">{b.title}</span>
                  <span className="block tabular">Tổng {formatVnd(total)}</span>
                  {SOURCE_KEYS.map((k) => (
                    <span key={k} className="block tabular text-paper/80">
                      {SOURCE_VIZ[k].label}: {formatVnd(b[k])}
                    </span>
                  ))}
                  {b.refund > 0 && <span className="block tabular text-paper/80">Hoàn tiền: −{formatVnd(b.refund)}</span>}
                </Tip>
                <span
                  aria-hidden
                  className={cn(
                    'absolute -bottom-6 left-1/2 -translate-x-1/2 text-[0.65rem] whitespace-nowrap text-muted tabular',
                    !ticks.has(i) && 'hidden',
                  )}
                >
                  {b.label}
                </span>
              </li>
            );
          })}
        </ol>
        <div aria-hidden className="h-6" />
      </div>
    </figure>
  );
}

export interface HBarRow {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  value: number;
  display: ReactNode;
}

/** Thanh ngang so sánh (chi nhánh, sân, nhóm hàng…): nhãn + số luôn hiện, thanh chỉ để so độ lớn. */
export function HBarList({
  rows,
  max,
  color = 'var(--viz-booking)',
  empty,
}: {
  rows: HBarRow[];
  max?: number;
  color?: string;
  empty?: string;
}) {
  const top = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.value)));
  if (rows.length === 0) return <p className="text-sm text-muted">{empty ?? 'Chưa có số liệu.'}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{r.label}</span>
              {r.sub && <span className="block text-xs text-muted">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-medium tabular">{r.display}</span>
          </div>
          <span aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-hall">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(0, (r.value / top) * 100)}%`, background: color }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Một thanh chia tỷ trọng theo nguồn tiền, kèm số và % từng phần. */
export function SourceSplit({ parts }: { parts: Record<SourceKey, number> }) {
  const total = SOURCE_KEYS.reduce((n, k) => n + Math.max(0, parts[k]), 0);
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-hall">
        {SOURCE_KEYS.map((k) =>
          parts[k] > 0 ? <span key={k} style={{ flexGrow: parts[k], flexBasis: 0, background: SOURCE_VIZ[k].color }} /> : null,
        )}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        {SOURCE_KEYS.map((k) => (
          <div key={k} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0.5">
            <dt className="inline-flex items-center gap-1.5 text-muted">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SOURCE_VIZ[k].color }} />
              {SOURCE_VIZ[k].label}
            </dt>
            <dd className="font-medium tabular">
              {formatVnd(parts[k])}
              <span className="ml-1 font-normal text-muted">
                {total > 0 ? `${Math.round((Math.max(0, parts[k]) / total) * 100)}%` : ''}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bản đồ nhiệt lấp sân: thứ (hàng) × giờ (cột). Một sắc xanh nhạt → đậm; số % hiện khi rê chuột / chạm. */
export function OccupancyHeatmap({ cells }: { cells: HeatCell[] }) {
  const grid = heatGrid(cells);
  if (grid.hours.length === 0) return <p className="text-sm text-muted">Chưa có giờ mở cửa / sân đang hoạt động.</p>;
  return (
    <figure className="flex flex-col gap-3">
      <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pt-16 -mt-14">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[0.65rem]">
          <caption className="sr-only">Tỷ lệ lấp sân theo thứ và giờ</caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" />
              {grid.hours.map((h) => (
                <th key={h} scope="col" className="font-normal text-muted tabular">
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_SHORT.map((label, i) => (
              <tr key={label}>
                <th scope="row" className="pr-1 text-left font-normal text-muted">
                  {label}
                </th>
                {grid.hours.map((h, hi) => {
                  const c = grid.get(i + 1, h);
                  const pct = c ? occupancyPct(c.booked, c.capacity) : null;
                  const level = heatLevel(pct);
                  return (
                    <td key={h} className="p-0">
                      <span
                        tabIndex={c ? 0 : -1}
                        className="group relative block h-7 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                        style={{ background: c ? `var(--viz-heat-${level})` : 'transparent' }}
                      >
                        <span className="sr-only">
                          {WEEKDAY_LONG[i]} {h}h: {pct === null ? 'đóng cửa' : `${pct}%`}
                        </span>
                        {c && (
                          <Tip align={hi < 3 ? 'left' : hi > grid.hours.length - 4 ? 'right' : 'center'}>
                            <span className="block font-medium">
                              {WEEKDAY_LONG[i]}, {h}:00–{h + 1}:00
                            </span>
                            <span className="block tabular">Lấp {pct ?? 0}%</span>
                            <span className="block tabular text-paper/80">
                              {Math.round(c.booked / 60)} / {Math.round(c.capacity / 60)} giờ sân
                            </span>
                          </Tip>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Vắng</span>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} aria-hidden className="h-3 w-6 rounded-[3px]" style={{ background: `var(--viz-heat-${l})` }} />
        ))}
        <span>Kín</span>
        <span className="ml-2">Mỗi ô: % giờ sân đã bán trong khung giờ đó (tính trên các ngày đã chọn).</span>
      </figcaption>
    </figure>
  );
}

/** Thẻ số liệu chính. */
export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-panel border border-line bg-paper p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-2xl leading-tight break-words tabular sm:text-[1.7rem]">{value}</span>
      {hint && (
        <span className={cn('text-sm', tone === 'up' ? 'text-court-deep' : tone === 'down' ? 'text-shuttle-deep' : 'text-muted')}>
          {hint}
        </span>
      )}
    </div>
  );
}
