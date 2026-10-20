'use client';

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleX,
  Copy,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Search,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Countdown } from '@/components/ui/interactive';
import { cn } from '@/lib/cn';
import { formatPhone, formatVnd } from '@/lib/format';
import { type Tone } from '@/lib/labels';

import { useMinuteClock } from '../hooks/use-clock';
import {
  BOOKING_STEPS,
  bookingJourney,
  bookingStatusInfo,
  bookingWhen,
  canGuestCancel,
  directionsUrl,
  paymentProgress,
  type BookingJourney,
  type StoppedStatus,
} from '../lib/lookup-view';
import { type BookingSummary } from '../schemas';

/** Màu nhãn trạng thái trên nền đen của cuống vé. */
const STUB_TONE: Record<Tone, string> = {
  green: 'bg-court text-on-court',
  amber: 'bg-amber-soft text-amber-deep',
  red: 'bg-shuttle text-paper',
  ink: 'bg-paper text-ink',
  neutral: 'bg-paper/15 text-paper',
};

const STATUS_NOTE: Record<string, string> = {
  held: 'Chi nhánh sẽ gọi xác nhận trong thời gian giữ chỗ. Đặt cọc để giữ sân chắc chắn.',
  confirmed: 'Sân đã sẵn sàng. Bạn nên đến sớm khoảng 10 phút để nhận sân.',
  checked_in: 'Bạn đã nhận sân. Chúc trận đấu thật vui!',
  completed: 'Cảm ơn bạn đã chơi tại Rally. Hẹn gặp lại trên sân!',
  cancelled: 'Đơn đã được hủy. Chi nhánh sẽ liên hệ nếu bạn được hoàn cọc.',
  expired: 'Hết thời gian giữ chỗ nhưng đơn chưa được xác nhận. Bạn có thể đặt lại giờ khác.',
  no_show: 'Đơn được ghi nhận là không đến sân.',
};

const STOPPED_TEXT: Record<StoppedStatus, string> = {
  cancelled: 'Đơn đã hủy',
  expired: 'Đơn hết hạn giữ chỗ',
  no_show: 'Không đến sân',
};

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      aria-label={copied ? 'Đã sao chép mã đơn' : 'Sao chép mã đơn'}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-paper/10 text-paper ring-1 ring-paper/20 transition-colors hover:bg-paper/20"
    >
      {copied ? <Check className="size-4 text-court" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  );
}

function JourneyTrack({ journey }: { journey: BookingJourney }) {
  if (journey.kind === 'stopped') {
    return (
      <p className="flex items-center gap-2 rounded-control bg-shuttle-soft px-3 py-2.5 text-sm font-medium text-shuttle-deep">
        <CircleX className="size-5 shrink-0" aria-hidden />
        {STOPPED_TEXT[journey.status]}
      </p>
    );
  }
  return (
    <ol className="grid grid-cols-4" aria-label="Tiến trình đơn">
      {BOOKING_STEPS.map((step, i) => {
        const done = i < journey.reached || journey.reached === BOOKING_STEPS.length - 1;
        const current = i === journey.reached;
        return (
          <li
            key={step.status}
            className="relative flex flex-col items-center gap-1.5 text-center"
            aria-current={current ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2', i <= journey.reached ? 'bg-court' : 'bg-line')}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid size-7 place-items-center rounded-full text-xs font-semibold',
                done && 'bg-court text-on-court',
                current && !done && 'bg-ink text-paper ring-4 ring-court/30',
                !done && !current && 'border-2 border-line bg-paper text-muted',
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-xs sm:text-sm', current ? 'font-semibold text-ink' : 'text-muted')}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function InfoBlock({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-soft text-court-deep">{icon}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
        {children}
      </div>
    </div>
  );
}

interface BookingTicketProps {
  booking: BookingSummary;
  phone: string;
  hotline: string | null;
  cancelAction: (formData: FormData) => void;
  cancelling: boolean;
  cancelError: string | null;
  cancelled: boolean;
  onLookupAnother?: () => void;
  /** Nút thêm ở hàng thao tác (ví dụ: quay lại danh sách đơn của thành viên). */
  extraAction?: ReactNode;
  /** Khối thanh toán chuyển khoản (mã QR) hiện ngay dưới vé. */
  payment?: ReactNode;
}

export function BookingTicket({
  booking,
  phone,
  hotline,
  cancelAction,
  cancelling,
  cancelError,
  cancelled,
  onLookupAnother,
  extraAction,
  payment,
}: BookingTicketProps) {
  const [confirming, setConfirming] = useState(false);
  const minute = useMinuteClock();
  const status = bookingStatusInfo(booking.status);
  const journey = bookingJourney(booking.status);
  const when = bookingWhen(booking.starts_at, booking.ends_at);
  const pay = paymentProgress(booking.total_amount, booking.paid_amount);
  // Đơn đã dừng (hủy / hết hạn / không đến) không còn khoản phải trả.
  const owing = journey.kind === 'progress';
  const branchName = booking.branch_name ?? 'Chi nhánh Rally';
  const cancellable = minute !== null && canGuestCancel(booking.status, booking.starts_at, minute * 60000);

  return (
    <div className="flex flex-col gap-4">
      <article className="animate-fade overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-lift lg:grid lg:grid-cols-[minmax(0,21rem)_1fr]">
        {/* CUỐNG VÉ ---------------------------------------------------------- */}
        <div className="relative isolate flex flex-col gap-4 overflow-hidden bg-ink p-5 text-paper sm:p-6 lg:p-7">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-court" />
          <svg aria-hidden viewBox="0 0 200 200" className="absolute -right-16 -bottom-16 -z-10 size-56 text-court opacity-20">
            <rect x="20" y="20" width="160" height="160" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 100 H180 M100 20 V180 M20 60 H180 M20 140 H180" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.2em] text-paper/60 uppercase">Mã đơn</span>
            <div className="flex items-center gap-3">
              <p className="font-display text-[2.3rem] leading-none tracking-wide whitespace-nowrap tabular sm:text-5xl lg:text-[2.5rem]">
                {booking.code}
              </p>
              <CopyCode code={booking.code} />
            </div>
          </div>
          <span
            className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', STUB_TONE[status.tone])}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {status.label}
          </span>
          <p className="text-sm leading-relaxed text-paper/75">{STATUS_NOTE[booking.status] ?? ''}</p>
          {booking.status === 'held' && booking.hold_expires_at && (
            <div className="rounded-control bg-paper/8 p-3 ring-1 ring-paper/15">
              <p className="text-xs text-paper/65">Thời gian giữ chỗ còn lại</p>
              <Countdown until={booking.hold_expires_at} className="font-display text-3xl text-court" expiredLabel="Đã hết thời gian giữ" />
            </div>
          )}
          {booking.contact_name && (
            <p className="mt-auto flex items-center gap-2 border-t border-paper/15 pt-4 text-sm text-paper/80">
              <UserRound className="size-4 shrink-0 text-paper/60" aria-hidden />
              <span className="truncate">
                Người đặt: <span className="font-medium text-paper">{booking.contact_name}</span>
              </span>
            </p>
          )}
        </div>

        {/* PHẦN THÂN VÉ ------------------------------------------------------ */}
        <div className="relative flex min-w-0 flex-col gap-6 p-5 sm:p-6 lg:p-8">
          {/* Đường răng cưa giữa cuống và thân vé */}
          <span
            aria-hidden
            className="absolute inset-x-5 top-0 border-t-2 border-dashed border-line lg:inset-x-auto lg:inset-y-5 lg:left-0 lg:border-t-0 lg:border-l-2"
          />
          <span aria-hidden className="absolute -top-3 -left-3 size-6 rounded-full border border-line bg-paper lg:-top-3 lg:-left-3" />
          <span
            aria-hidden
            className="absolute -top-3 -right-3 size-6 rounded-full border border-line bg-paper lg:top-auto lg:-bottom-3 lg:-left-3 lg:right-auto"
          />

          <JourneyTrack journey={journey} />

          <div className="grid gap-5 sm:grid-cols-2">
            <InfoBlock icon={<CalendarDays className="size-5" aria-hidden />} label="Thời gian">
              <span className="font-display text-2xl leading-tight">
                {when.weekday}, {when.dayMonth}
                <span className="text-muted">/{when.year}</span>
              </span>
              <span className="text-[0.95rem] font-medium tabular">{when.timeRange}</span>
              <span className="text-sm text-muted">Thời lượng {when.duration}</span>
            </InfoBlock>
            <InfoBlock icon={<MapPin className="size-5" aria-hidden />} label="Địa điểm">
              <span className="font-display text-2xl leading-tight">{branchName}</span>
              {booking.court_name && (
                <span className="w-fit rounded-md bg-ink px-2 py-0.5 text-sm font-medium text-paper">{booking.court_name}</span>
              )}
              {booking.branch_address && <span className="text-sm text-muted">{booking.branch_address}</span>}
              <a
                href={directionsUrl(branchName, booking.branch_address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex w-fit items-center gap-1 text-sm font-medium text-court-deep hover:underline hover:underline-offset-4"
              >
                <Navigation className="size-3.5" aria-hidden />
                Chỉ đường
              </a>
            </InfoBlock>
          </div>

          <div className="rounded-panel bg-hall p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-2.5">
                <Wallet className="size-5 text-court-deep" aria-hidden />
                <span className="text-sm text-muted">Tổng tiền sân</span>
              </div>
              <span className="font-display text-3xl tabular">{formatVnd(booking.total_amount)}</span>
            </div>
            {owing && (
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper ring-1 ring-line"
                role="progressbar"
                aria-label="Đã thanh toán"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pay.percent}
              >
                <span className="block h-full rounded-full bg-court transition-[width] duration-500" style={{ width: `${pay.percent}%` }} />
              </div>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Đã thanh toán</dt>
                <dd className="font-semibold text-court-deep tabular">{formatVnd(booking.paid_amount)}</dd>
              </div>
              {owing && (
                <div>
                  <dt className="text-muted">{pay.settled ? 'Trạng thái' : 'Còn lại'}</dt>
                  <dd className="font-semibold tabular">{pay.settled ? 'Đã đủ' : formatVnd(pay.remaining)}</dd>
                </div>
              )}
              {booking.deposit_amount > 0 && (
                <div>
                  <dt className="text-muted">Tiền cọc</dt>
                  <dd className="font-semibold tabular">{formatVnd(booking.deposit_amount)}</dd>
                </div>
              )}
              {booking.refund_entitlement !== null && (
                <div className={owing ? 'col-span-2 sm:col-span-3' : undefined}>
                  <dt className="text-muted">Được hoàn theo chính sách</dt>
                  <dd className="font-semibold text-shuttle-deep tabular">{formatVnd(booking.refund_entitlement)}</dd>
                </div>
              )}
            </dl>
          </div>

          {cancelError && (
            <p role="alert" className="rounded-control bg-shuttle-soft px-3 py-2.5 text-sm text-shuttle-deep">
              {cancelError}
            </p>
          )}
          {cancelled && (
            <p role="status" className="rounded-control bg-court-soft px-3 py-2.5 text-sm text-court-deep">
              Đã hủy đơn. Chi nhánh sẽ liên hệ nếu bạn được hoàn cọc.
            </p>
          )}

          {confirming && cancellable ? (
            <form
              action={cancelAction}
              className="flex flex-col gap-3 rounded-panel border border-shuttle/40 bg-shuttle-soft p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <input type="hidden" name="code" value={booking.code} />
              <input type="hidden" name="phone" value={phone} />
              <div className="text-sm text-shuttle-deep">
                <p className="font-semibold">Hủy đơn {booking.code}?</p>
                <p>Thao tác không hoàn tác được. Tiền cọc (nếu có) hoàn theo chính sách chi nhánh.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className={buttonClass('outline', 'md', 'flex-1 sm:flex-none')}>
                  Giữ đơn
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className={buttonClass('primary', 'md', 'flex-1 bg-shuttle hover:bg-shuttle-deep sm:flex-none')}
                >
                  {cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/booking" className={buttonClass('brand', 'md')}>
                Đặt thêm sân
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              {hotline && (
                <a href={`tel:${hotline}`} className={buttonClass('outline', 'md')}>
                  <Phone className="size-4" aria-hidden />
                  {formatPhone(hotline)}
                </a>
              )}
              {onLookupAnother && (
                <button type="button" onClick={onLookupAnother} className={buttonClass('ghost', 'md')}>
                  <Search className="size-4" aria-hidden />
                  Tra cứu đơn khác
                </button>
              )}
              {extraAction}
              {cancellable && (
                <button type="button" onClick={() => setConfirming(true)} className={buttonClass('danger', 'md', 'sm:ml-auto')}>
                  <RotateCcw className="size-4" aria-hidden />
                  Hủy đơn
                </button>
              )}
            </div>
          )}
        </div>
      </article>
      {payment}
    </div>
  );
}
