import { ChevronRight, Gift, MapPin } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/primitives';
import { bookingStatusInfo, bookingWhen } from '@/features/booking/lib/lookup-view';
import { cn } from '@/lib/cn';

import { type MemberBooking } from '../schemas';

/** Một đơn trong danh sách của thành viên: khối ngày lớn + sân + giờ + trạng thái. */
export function MemberBookingCard({ booking, upcoming }: { booking: MemberBooking; upcoming?: boolean }) {
  const when = bookingWhen(booking.starts_at, booking.ends_at);
  const status = bookingStatusInfo(booking.status);
  const [day, month] = when.dayMonth.split('/');
  return (
    <Link
      href={`/account/bookings/${booking.code}`}
      className="group flex items-stretch gap-4 rounded-panel border border-line bg-paper p-3 transition-shadow hover:shadow-lift sm:p-4"
    >
      <span
        className={cn(
          'flex w-16 shrink-0 flex-col items-center justify-center rounded-control py-2 sm:w-[4.5rem]',
          upcoming ? 'bg-ink text-paper' : 'bg-hall text-ink',
        )}
      >
        <span className={cn('text-[0.65rem] font-semibold tracking-wide uppercase', upcoming ? 'text-court' : 'text-muted')}>
          Th {month}
        </span>
        <span className="font-display text-3xl leading-none">{day}</span>
        <span className={cn('text-[0.7rem]', upcoming ? 'text-paper/70' : 'text-muted')}>{when.weekday}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular">{when.timeRange}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
        <span className="flex items-center gap-1.5 truncate text-sm text-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {booking.branch_name} · {booking.court_name}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span className="font-display text-sm tracking-wide text-ink">{booking.code}</span>
          {booking.points_earned ? (
            <span className="inline-flex items-center gap-1 text-court-deep">
              <Gift className="size-3.5" aria-hidden />+{booking.points_earned} điểm
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 self-center text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
