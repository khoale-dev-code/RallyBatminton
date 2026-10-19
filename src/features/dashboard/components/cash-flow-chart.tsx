import { formatVnd, formatVndShort } from '@/lib/format';

import { barHeights, tickIndexes, type DayBar } from '../lib/metrics';

export const SOURCE_STYLE = {
  booking: { label: 'Tiền sân', className: 'bg-court' },
  sale: { label: 'Bán hàng', className: 'bg-ink' },
  rental: { label: 'Cho thuê', className: 'bg-shuttle' },
} as const;

function dayLabel(day: string): string {
  const [, m, d] = day.slice(0, 10).split('-');
  return `${d}/${m}`;
}

/** Biểu đồ cột chồng tiền vào theo ngày (Tiền sân / Bán hàng / Cho thuê). Không cần thư viện, hiện được khi tắt JS. */
export function CashFlowChart({ series }: { series: DayBar[] }) {
  const { max, bars } = barHeights(series);
  const ticks = new Set(tickIndexes(bars.length));
  const dense = bars.length > 40;
  const best = bars.reduce<(typeof bars)[number] | null>((top, b) => (!top || b.total > top.total ? b : top), null);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {Object.entries(SOURCE_STYLE).map(([key, s]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-sm ${s.className}`} />
            {s.label}
          </span>
        ))}
        {best && best.total > 0 && (
          <span className="ml-auto">
            Cao nhất: {formatVnd(best.total)} ({dayLabel(best.day)})
          </span>
        )}
      </figcaption>

      <div className="relative">
        {/* Vạch chia ngang */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
          {[max, max / 2, 0].map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-right text-[0.65rem] text-muted tabular">{v > 0 ? formatVndShort(v) : '0'}</span>
              <span className="h-px flex-1 border-t border-dashed border-line" />
            </div>
          ))}
        </div>

        <ol
          className={`relative ml-11 flex h-48 items-end sm:h-56 ${dense ? 'gap-px' : 'gap-0.5 sm:gap-1'}`}
          aria-label="Tiền vào theo ngày"
        >
          {bars.map((b, i) => (
            <li
              key={b.day}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${dayLabel(b.day)}: ${formatVnd(b.total)} (sân ${formatVnd(b.booking)}, bán ${formatVnd(b.sale)}, thuê ${formatVnd(b.rental)}${b.refund ? `, hoàn ${formatVnd(b.refund)}` : ''})`}
            >
              <span className="sr-only">
                {dayLabel(b.day)}: {formatVnd(b.total)}
              </span>
              <span
                aria-hidden
                className="flex w-full flex-col overflow-hidden rounded-t-[3px] transition-opacity group-hover:opacity-80"
                style={{ height: `${b.h.booking + b.h.sale + b.h.rental}%`, minHeight: b.total > 0 ? 2 : 0 }}
              >
                <span className={`basis-0 ${SOURCE_STYLE.rental.className}`} style={{ flexGrow: b.rental }} />
                <span className={`basis-0 ${SOURCE_STYLE.sale.className}`} style={{ flexGrow: b.sale }} />
                <span className={`basis-0 ${SOURCE_STYLE.booking.className}`} style={{ flexGrow: b.booking }} />
              </span>
              <span
                aria-hidden
                className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[0.65rem] whitespace-nowrap text-muted tabular ${ticks.has(i) ? '' : 'hidden'}`}
              >
                {dayLabel(b.day)}
              </span>
            </li>
          ))}
        </ol>
        <div aria-hidden className="h-6" />
      </div>
    </figure>
  );
}
