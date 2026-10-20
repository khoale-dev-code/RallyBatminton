'use client';

import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { describeDateKey, formatPhone, formatVnd } from '@/lib/format';
import { dateKeyInZone } from '@/lib/time';

import { type RevealState } from '../actions';
import { useMinuteClock } from '../hooks/use-clock';
import { bookingStatusInfo, bookingWhen, groupPhoneBookings } from '../lib/lookup-view';
import { type PhoneBooking } from '../schemas';

/** Lịch sử dài: hiện trước vài đơn gần nhất, bấm để xem thêm. */
const PAST_PREVIEW = 6;

function maskPhone(phone: string): string {
  const f = formatPhone(phone);
  return f.length >= 12 ? `${f.slice(0, 4)} *** ${f.slice(-3)}` : f;
}

interface PhoneBookingListProps {
  phone: string;
  items: PhoneBooking[];
  memberBookings: number;
  hotline: string | null;
  revealAction: (formData: FormData) => void;
  reveal: RevealState;
  revealing: boolean;
  onSearchAnother: () => void;
}

/** Đơn của khách vãng lai theo số điện thoại: Hôm nay / Sắp tới / Lịch sử. Mở chi tiết bằng họ tên người đặt. */
export function PhoneBookingList({
  phone,
  items,
  memberBookings,
  hotline,
  revealAction,
  reveal,
  revealing,
  onSearchAnother,
}: PhoneBookingListProps) {
  const minute = useMinuteClock();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const groups = minute === null ? [] : groupPhoneBookings(items, minute * 60000);

  return (
    <section aria-labelledby="phone-list-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-court-strong uppercase">
            <span aria-hidden className="size-2 rounded-full bg-shuttle" />
            Khách vãng lai
          </span>
          <h2 id="phone-list-title" className="text-3xl sm:text-4xl">
            Đơn của số <span className="tabular">{maskPhone(phone)}</span>
          </h2>
          <p className="text-sm text-muted">
            {items.length > 0 ? `${items.length} đơn trong 6 tháng gần đây (gồm đơn sắp tới).` : 'Không có đơn nào trong 6 tháng gần đây.'}
          </p>
        </div>
        <button type="button" onClick={onSearchAnother} className={buttonClass('outline', 'md', 'w-full sm:w-auto')}>
          <RotateCcw className="size-4" aria-hidden />
          Tìm số khác
        </button>
      </header>

      {items.length > 0 && (
        <p className="flex items-start gap-2.5 rounded-panel bg-court-soft px-4 py-3 text-sm text-court-deep">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Mã đơn được che bớt để người khác biết số của bạn cũng không xem hay hủy được đơn. Bấm <strong>Xem chi tiết</strong> và nhập họ
            tên người đặt để xem đầy đủ mã đơn, thanh toán và tự hủy đơn.
          </span>
        </p>
      )}

      {memberBookings > 0 && (
        <Link
          href="/login?next=/account/bookings"
          className="flex items-center gap-3 rounded-panel border border-line bg-paper p-4 transition-colors hover:border-court"
        >
          <UserRound className="size-5 shrink-0 text-court-deep" aria-hidden />
          <span className="flex-1 text-sm">
            Số này còn <strong>{memberBookings} đơn</strong> đặt khi đăng nhập tài khoản thành viên — đăng nhập để xem.
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-panel border border-dashed border-line p-6">
          <p className="max-w-xl text-muted">
            Kiểm tra lại số điện thoại đã dùng khi đặt sân. Đơn đặt tại quầy hoặc qua hotline cũng hiện ở đây nếu nhân viên ghi đúng số của
            bạn.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/booking" className={buttonClass('brand', 'md')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            {hotline && (
              <a href={`tel:${hotline}`} className={buttonClass('outline', 'md')}>
                <Phone className="size-4" aria-hidden />
                Gọi {formatPhone(hotline)}
              </a>
            )}
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-xl">
              {group.title}
              <span className="rounded-full bg-hall px-2 py-0.5 font-sans text-xs text-muted">{group.items.length}</span>
            </h3>
            <ul className="grid gap-3 lg:grid-cols-2">
              {(group.key === 'past' && !showAllPast ? group.items.slice(0, PAST_PREVIEW) : group.items).map((b) => (
                <PhoneBookingCard
                  key={b.booking_id}
                  booking={b}
                  phone={phone}
                  dimmed={group.key === 'past'}
                  highlight={group.key === 'today'}
                  open={openId === b.booking_id}
                  onToggle={() => setOpenId((id) => (id === b.booking_id ? null : b.booking_id))}
                  revealAction={revealAction}
                  error={reveal.status === 'error' && reveal.bookingId === b.booking_id ? (reveal.message ?? null) : null}
                  revealing={revealing}
                />
              ))}
            </ul>
            {group.key === 'past' && !showAllPast && group.items.length > PAST_PREVIEW && (
              <button type="button" onClick={() => setShowAllPast(true)} className={buttonClass('outline', 'md', 'w-full sm:w-fit')}>
                Xem thêm {group.items.length - PAST_PREVIEW} đơn cũ hơn
                <ChevronDown className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ))
      )}
    </section>
  );
}

interface PhoneBookingCardProps {
  booking: PhoneBooking;
  phone: string;
  dimmed: boolean;
  highlight: boolean;
  open: boolean;
  onToggle: () => void;
  revealAction: (formData: FormData) => void;
  error: string | null;
  revealing: boolean;
}

function PhoneBookingCard({ booking, phone, dimmed, highlight, open, onToggle, revealAction, error, revealing }: PhoneBookingCardProps) {
  const when = bookingWhen(booking.starts_at, booking.ends_at);
  const status = bookingStatusInfo(booking.status);
  const weekday = describeDateKey(dateKeyInZone(new Date(booking.starts_at))).weekdayShort;
  const formId = `reveal-${booking.booking_id}`;

  return (
    <li
      className={cn(
        'flex flex-col overflow-hidden rounded-panel border bg-paper transition-shadow',
        highlight ? 'border-court shadow-lift' : 'border-line',
        open && 'shadow-lift',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={formId}
        className="flex w-full gap-3 p-3 text-left sm:p-4"
      >
        <span
          className={cn(
            'flex w-16 shrink-0 flex-col items-center justify-center rounded-control py-2',
            dimmed ? 'bg-hall text-muted' : highlight ? 'bg-court text-on-court' : 'bg-ink text-paper',
          )}
        >
          <span className="text-[0.65rem] font-medium uppercase">{weekday}</span>
          <span className="font-display text-2xl leading-none">{when.dayMonth.slice(0, 2)}</span>
          <span className="text-[0.65rem]">Th {when.dayMonth.slice(3)}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl leading-tight tabular">{when.timeRange}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
          <span className="flex items-center gap-1.5 truncate text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {booking.branch_name} · {booking.court_name}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="font-display text-sm tracking-wider text-ink">{booking.code_masked}</span>
            {booking.name_hint && <span>Người đặt: …{booking.name_hint}</span>}
            <span className="tabular">
              {formatVnd(booking.total_amount)}
              {booking.paid_amount > 0 && ` · đã trả ${formatVnd(booking.paid_amount)}`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-start pt-1">
          <ChevronDown className={cn('size-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          <span className="sr-only">{open ? 'Thu gọn' : 'Xem chi tiết'}</span>
        </span>
      </button>

      {open && (
        <form
          id={formId}
          action={revealAction}
          className="animate-fade flex flex-col gap-3 border-t border-line bg-hall/60 p-3 sm:p-4"
          noValidate
        >
          <input type="hidden" name="bookingId" value={booking.booking_id} />
          <input type="hidden" name="phone" value={phone} />
          <label htmlFor={`${formId}-name`} className="flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="size-4 text-court-deep" aria-hidden />
            Nhập họ tên người đặt để xem chi tiết
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${formId}-name`}
              name="name"
              autoComplete="name"
              autoFocus
              placeholder="Ví dụ: Nguyễn Văn An"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${formId}-error` : `${formId}-hint`}
              className="min-h-11 w-full rounded-control border border-line bg-paper px-3 focus:border-court-strong focus:ring-4 focus:ring-court/20 focus:outline-none aria-[invalid=true]:border-shuttle-deep"
            />
            <button type="submit" disabled={revealing} className={buttonClass('primary', 'md', 'min-h-11 shrink-0')}>
              {revealing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
              {revealing ? 'Đang mở…' : 'Xem chi tiết'}
            </button>
          </div>
          {error ? (
            <p id={`${formId}-error`} role="alert" className="text-sm text-shuttle-deep">
              {error}
            </p>
          ) : (
            <p id={`${formId}-hint`} className="text-xs text-muted">
              Đúng họ tên đã điền khi đặt sân, có dấu hay không dấu đều được. Sai quá nhiều lần sẽ bị tạm khóa 1 giờ.
            </p>
          )}
        </form>
      )}
    </li>
  );
}
