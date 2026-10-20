'use client';

import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheckBig,
  Copy,
  Download,
  Landmark,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { refreshGuestBookingAction } from '@/features/booking/actions';
import { type BookingSummary } from '@/features/booking/schemas';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import { amountsDue, transferContent, vietQrImageUrl, type BankAccount } from '../lib/transfer';

const POLL_MS = 4000;

function CopyValue({ label, value, display, strong }: { label: string; value: string; display?: string; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate text-right tabular', strong ? 'font-display text-lg tracking-wide text-ink' : 'font-medium')}>
          {display ?? value}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          aria-label={copied ? `Đã sao chép ${label.toLowerCase()}` : `Sao chép ${label.toLowerCase()}`}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-court-deep" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </span>
    </div>
  );
}

interface DepositQrProps {
  booking: BookingSummary;
  phone: string;
  account: BankAccount;
  /** Đơn thay đổi (đã nhận tiền, đã xác nhận) — để khung bên ngoài cập nhật theo. */
  onUpdate?: (booking: BookingSummary) => void;
  /** Trang xem trạng thái đơn sau khi chuyển xong (khách vãng lai: Tra cứu; thành viên: trang đơn). */
  statusHref?: string | null;
  /** Đã trả đủ cọc thì thu gọn mã QR trả phần còn lại (tắt khi khung ngoài đã tự thu gọn). */
  collapseRemaining?: boolean;
  className?: string;
}

interface Received {
  amount: number;
  confirmed: boolean;
}

/** Thông báo rõ ràng ngay khi tiền về (trang tự hỏi lại vài giây một lần). */
function PaymentSuccess({
  received,
  booking,
  statusHref,
  depositShort,
}: {
  received: Received;
  booking: BookingSummary;
  statusHref: string | null;
  depositShort: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Tiền vừa về: đưa thông báo vào giữa màn hình (điện thoại thường đang ở cuối trang mã QR / app ngân hàng).
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div
      ref={ref}
      role="alert"
      className="animate-fade flex flex-col gap-3 rounded-panel border-2 border-court bg-court-soft p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-court text-on-court">
        <CircleCheckBig className="size-7" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-display text-2xl leading-tight">Chuyển khoản thành công!</p>
        <p className="text-sm">
          Rally đã nhận <strong className="tabular">{formatVnd(received.amount)}</strong> cho đơn{' '}
          <strong className="tracking-wide whitespace-nowrap">{booking.code}</strong>.{' '}
          {received.confirmed
            ? 'Sân đã được xác nhận — hẹn gặp bạn trên sân!'
            : depositShort > 0
              ? `Còn thiếu ${formatVnd(depositShort)} tiền cọc, chuyển thêm bằng mã bên dưới.`
              : 'Chi nhánh sẽ xác nhận đơn trong ít phút.'}
        </p>
      </div>
      {statusHref && (
        <Link
          href={statusHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-ink px-4 font-medium text-paper hover:bg-ink/85"
        >
          Xem trạng thái đơn
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * Mã VietQR chuyển khoản cọc (SePay). Khách quét / lưu ảnh hoặc chép thông tin; trang tự hỏi lại vài giây
 * một lần và báo ngay khi tiền về — chi nhánh không cần bấm xác nhận tay.
 */
export function DepositQr({ booking: initial, phone, account, onUpdate, statusHref, collapseRemaining = true, className }: DepositQrProps) {
  const [booking, setBooking] = useState(initial);
  const [received, setReceived] = useState<Received | null>(null);
  const href = statusHref === undefined ? `/booking/lookup?code=${encodeURIComponent(initial.code)}` : statusHref;
  const due = amountsDue(booking.total_amount, booking.deposit_amount, booking.paid_amount);
  const [mode, setMode] = useState<'deposit' | 'full'>(due.deposit > 0 ? 'deposit' : 'full');
  const amount = mode === 'deposit' && due.deposit > 0 ? due.deposit : due.full;
  const content = transferContent(booking.code, account.memoPrefix);
  const depositDone = booking.deposit_amount > 0 ? due.deposit === 0 : booking.paid_amount > 0;
  const settled = due.full === 0;
  const waiting = !settled && ['held', 'confirmed'].includes(booking.status);

  const latest = useRef(booking);
  useEffect(() => {
    latest.current = booking;
  }, [booking]);

  const apply = useEffectEvent((next: BookingSummary) => {
    const prev = latest.current;
    if (prev.paid_amount === next.paid_amount && prev.status === next.status) return;
    latest.current = next;
    setBooking(next);
    if (next.paid_amount > prev.paid_amount) {
      setReceived((r) => ({ amount: (r?.amount ?? 0) + next.paid_amount - prev.paid_amount, confirmed: next.status === 'confirmed' }));
      // Rung nhẹ trên điện thoại + đổi tiêu đề tab để khách đang ở app ngân hàng quay lại là thấy ngay.
      navigator.vibrate?.(180);
      document.title = `✓ Đã nhận tiền — ${next.code}`;
    } else if (next.status === 'confirmed') {
      setReceived((r) => (r ? { ...r, confirmed: true } : r));
    }
    onUpdate?.(next);
  });

  // Tự hỏi lại khi đang chờ tiền (dừng khi trang ẩn, khi đã trả đủ hoặc đơn kết thúc).
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const next = await refreshGuestBookingAction(booking.code, phone);
      if (!stopped && next) apply(next);
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    // Quay lại từ app ngân hàng → hỏi ngay, không chờ hết chu kỳ.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [waiting, booking.code, phone]);

  const success = received ? <PaymentSuccess received={received} booking={booking} statusHref={href} depositShort={due.deposit} /> : null;

  if (settled) {
    if (success) return <div className={className}>{success}</div>;
    return (
      <div className={cn('flex items-start gap-3 rounded-panel bg-court-soft p-4 text-court-deep', className)} role="status">
        <BadgeCheck className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Đã thanh toán đủ {formatVnd(booking.total_amount)}</p>
          <p className="text-sm">Hẹn gặp bạn trên sân!</p>
        </div>
      </div>
    );
  }
  if (!['held', 'confirmed', 'checked_in'].includes(booking.status)) return success;

  const qr = (
    <section
      aria-labelledby={`qr-${booking.code}`}
      className={cn('overflow-hidden rounded-panel border border-line bg-paper', !success && className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-3 text-paper sm:px-5">
        <h3 id={`qr-${booking.code}`} className="flex items-center gap-2 font-display text-xl">
          <QrCode className="size-5 text-court" aria-hidden />
          {depositDone ? 'Thanh toán phần còn lại' : 'Chuyển khoản đặt cọc'}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-court px-2.5 py-0.5 text-xs font-semibold text-on-court">
          <Zap className="size-3.5" aria-hidden />
          Tự xác nhận
        </span>
      </header>

      {depositDone && booking.deposit_amount > 0 && (
        <p className="flex items-center gap-2 border-b border-line bg-court-soft px-4 py-2.5 text-sm text-court-deep sm:px-5" role="status">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          Đã nhận cọc {formatVnd(booking.paid_amount)}
          {booking.status === 'confirmed' ? ' — đơn đã được xác nhận.' : '.'}
        </p>
      )}

      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="flex flex-col items-center gap-3">
          {!depositDone && due.deposit > 0 && due.full > due.deposit && (
            <div
              role="radiogroup"
              aria-label="Số tiền chuyển"
              className="grid w-full grid-cols-2 gap-1 rounded-control bg-hall p-1 text-sm"
            >
              {(
                [
                  ['deposit', `Cọc ${formatVnd(due.deposit)}`],
                  ['full', `Trả hết ${formatVnd(due.full)}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'min-h-9 rounded-[0.4rem] px-2 font-medium whitespace-nowrap transition-colors',
                    mode === key ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="relative aspect-[4/5] w-full max-w-[15rem] overflow-hidden rounded-control border border-line bg-paper">
            <Image
              key={`${amount}-${content}`}
              src={vietQrImageUrl(account, amount, content)}
              alt={`Mã QR chuyển ${formatVnd(amount)} với nội dung ${content}`}
              fill
              unoptimized
              sizes="240px"
              className="object-contain"
            />
          </div>
          <a
            href={vietQrImageUrl(account, amount, content, { download: true })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-sm font-medium hover:border-ink"
          >
            <Download className="size-4" aria-hidden />
            Lưu ảnh mã QR
          </a>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-muted">
            Mở app ngân hàng → <strong className="text-ink">Quét QR</strong> (hoặc chọn ảnh QR đã lưu). Số tiền và nội dung đã điền sẵn.
          </p>
          <div className="divide-y divide-line rounded-control border border-line px-3">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-muted">Ngân hàng</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Landmark className="size-4 text-muted" aria-hidden />
                {account.bankCode}
              </span>
            </div>
            <CopyValue label="Số tài khoản" value={account.accountNo} />
            {account.accountName && (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-muted">Chủ tài khoản</span>
                <span className="min-w-0 text-right font-medium break-words uppercase">{account.accountName}</span>
              </div>
            )}
            <CopyValue label="Số tiền" value={String(amount)} display={formatVnd(amount)} strong />
            <CopyValue label="Nội dung" value={content} strong />
          </div>
          <p className="flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2 text-xs leading-relaxed text-amber-deep">
            <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
            <span>
              Ghi đúng nội dung <strong>{content}</strong> để hệ thống tự nhận ra đơn của bạn.
            </span>
          </p>
          {waiting && (
            <p className="flex items-center gap-2 text-sm text-court-deep" role="status" aria-live="polite">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Đang chờ tiền về — trang tự cập nhật ngay khi nhận được, bạn không cần làm gì thêm.
            </p>
          )}
        </div>
      </div>
    </section>
  );

  // Đã đủ cọc trong phiên này: thông báo thành công đứng đầu, mã QR trả phần còn lại thu gọn.
  if (success && depositDone && collapseRemaining) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {success}
        <details className="group rounded-panel border border-line bg-paper">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-medium">
            Trả nốt phần còn lại ({formatVnd(due.full)}) bằng chuyển khoản
            <span className="text-muted group-open:hidden">Mở mã QR</span>
          </summary>
          <div className="border-t border-line p-3">{qr}</div>
        </details>
      </div>
    );
  }
  return success ? (
    <div className={cn('flex flex-col gap-3', className)}>
      {success}
      {qr}
    </div>
  ) : (
    qr
  );
}
