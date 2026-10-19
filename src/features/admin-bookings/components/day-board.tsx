import Link from 'next/link';

import { buildDaySlots } from '@/features/booking/lib/slots';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { zonedToUtc } from '@/lib/time';

import { type DayBooking } from '../queries';

interface DayBoardProps {
  dateKey: string;
  tz: string;
  opensAt: string;
  closesAt: string;
  courts: Array<{ id: string; name: string; status: string }>;
  bookings: DayBooking[];
  canOperate: boolean;
}

const ROW_PX = 36;

function blockStyle(b: DayBooking): string {
  if (b.kind === 'block') return 'border-ink/30 bg-[repeating-linear-gradient(135deg,#f3f5f1_0_6px,#e4e8e1_6px_12px)] text-ink';
  switch (b.status) {
    case 'held':
      return 'border-amber-deep/40 bg-amber-soft text-amber-deep';
    case 'confirmed':
      return 'border-court bg-court text-ink';
    case 'checked_in':
      return 'border-ink bg-ink text-paper';
    default:
      return 'border-line bg-hall text-muted';
  }
}

/** Lưới sân × giờ của một ngày. Ô trống bấm để tạo đơn tại quầy. */
export function DayBoard({ dateKey, tz, opensAt, closesAt, courts, bookings, canOperate }: DayBoardProps) {
  const slots = buildDaySlots(opensAt, closesAt, 30);
  const dayOpenMs = zonedToUtc(dateKey, opensAt, tz).getTime();
  const visible = bookings.filter((b) => ['held', 'confirmed', 'checked_in', 'completed'].includes(b.status));
  /** Hàng lưới (bắt đầu từ 2) tương ứng thời điểm; đơn tràn qua ngày được cắt theo giờ mở/đóng. */
  const rowOf = (date: Date) => Math.round((date.getTime() - dayOpenMs) / (30 * 60000)) + 2;

  return (
    // Cuộn cả 2 chiều trong khung: tên sân (hàng đầu) và cột giờ luôn dính khi cuộn trên điện thoại/máy tính bảng.
    <div className="max-h-[75dvh] overflow-auto overscroll-contain rounded-panel border border-line bg-paper">
      <div
        className="relative grid min-w-max"
        style={{
          gridTemplateColumns: `56px repeat(${courts.length}, minmax(116px, 1fr))`,
          gridTemplateRows: `40px repeat(${slots.length}, ${ROW_PX}px)`,
        }}
      >
        <div className="sticky top-0 left-0 z-30 border-b border-line bg-paper" style={{ gridColumn: 1, gridRow: 1 }} />
        {courts.map((c, i) => (
          <div
            key={c.id}
            className="sticky top-0 z-20 flex items-center border-b border-l border-line bg-paper px-3 font-display text-base whitespace-nowrap"
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {c.name}
            {c.status === 'maintenance' && <span className="ml-2 text-xs font-sans text-amber-deep">bảo trì</span>}
          </div>
        ))}
        {slots.map((s, r) => (
          <div
            key={s.start}
            className="sticky left-0 z-10 border-b border-line/60 bg-paper pr-2 text-right text-xs text-muted tabular"
            style={{ gridColumn: 1, gridRow: r + 2 }}
          >
            {s.start.endsWith(':00') ? s.start : ''}
          </div>
        ))}
        {courts.map((c, ci) =>
          slots.map((s, r) =>
            canOperate ? (
              <Link
                key={`${c.id}-${s.start}`}
                href={`/admin/bookings/new?court=${c.id}&date=${dateKey}&start=${s.start}`}
                aria-label={`Tạo đơn ${c.name} lúc ${s.start}`}
                className="border-b border-l border-line/60 hover:bg-court-soft"
                style={{ gridColumn: ci + 2, gridRow: r + 2 }}
              />
            ) : (
              <div key={`${c.id}-${s.start}`} className="border-b border-l border-line/60" style={{ gridColumn: ci + 2, gridRow: r + 2 }} />
            ),
          ),
        )}
        {visible.map((b) => {
          const col = courts.findIndex((c) => c.id === b.court_id);
          if (col < 0) return null;
          const startRow = Math.max(2, rowOf(b.start));
          const endRow = Math.min(slots.length + 2, rowOf(b.end));
          if (endRow <= startRow) return null;
          return (
            <Link
              key={b.id}
              href={`/admin/bookings/${b.id}`}
              className={cn(
                'z-10 m-0.5 flex flex-col overflow-hidden rounded-control border px-2 py-1 text-xs leading-tight shadow-sm hover:brightness-95',
                blockStyle(b),
              )}
              style={{ gridColumn: col + 2, gridRow: `${startRow} / ${endRow}` }}
            >
              <span className="font-medium tabular">
                {formatTime(b.start, tz)}–{formatTime(b.end, tz)}
              </span>
              <span className="truncate">{b.kind === 'block' ? (b.internal_note ?? 'Khóa sân') : b.contact_name}</span>
              {b.status === 'held' && <span>Chờ xác nhận</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
