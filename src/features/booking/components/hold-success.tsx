'use client';

import { BadgeCheck, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Countdown } from '@/components/ui/interactive';
import { DepositQr } from '@/features/payments/components/deposit-qr';
import { type BankAccount } from '@/features/payments/lib/transfer';
import { formatDate, formatPhone, formatTime, formatVnd } from '@/lib/format';

import { type BookingSummary } from '../schemas';

interface HoldSuccessProps {
  booking: BookingSummary;
  branchName: string;
  courtName: string;
  tz: string;
  paymentInstructions: string | null;
  hotline: string | null;
  /** Đơn đã gắn vào tài khoản thành viên đang đăng nhập. */
  savedToAccount?: boolean;
  /** Tài khoản nhận cọc (SePay) — có thì hiện mã QR chuyển khoản và tự xác nhận. */
  bank: BankAccount | null;
  phone: string;
  onBookAnother: () => void;
}

export function HoldSuccess({
  booking: initialBooking,
  branchName,
  courtName,
  tz,
  paymentInstructions,
  hotline,
  savedToAccount = false,
  bank,
  phone,
  onBookAnother,
}: HoldSuccessProps) {
  const [booking, setBooking] = useState(initialBooking);
  const ref = useRef<HTMLElement>(null);
  // Điện thoại: khung xác nhận thay cho lưới giờ — cuộn tới đầu khung để khách thấy mã đơn và mã QR.
  useEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const confirmed = booking.status === 'confirmed';
  const showQr = bank !== null && booking.total_amount > 0;
  return (
    <section ref={ref} className="animate-fade scroll-mt-20 overflow-hidden rounded-panel border border-ink" aria-labelledby="hold-title">
      <div className="bg-court px-5 py-6 sm:px-8">
        <p id="hold-title" className="flex items-center gap-2 text-sm">
          {confirmed ? (
            <>
              <CircleCheck className="size-4" aria-hidden />
              Đã nhận cọc — đơn đã được xác nhận. Mã đơn của bạn
            </>
          ) : (
            'Đã giữ sân. Mã đơn của bạn'
          )}
        </p>
        <p className="font-display text-5xl tracking-wide tabular sm:text-6xl">{booking.code}</p>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-8">
        <dl className="grid gap-3 text-[0.95rem]">
          <div>
            <dt className="text-sm text-muted">Sân</dt>
            <dd className="font-medium">
              {courtName}, {branchName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Thời gian</dt>
            <dd className="font-medium">
              {formatTime(booking.starts_at, tz)}–{formatTime(booking.ends_at, tz)}, {formatDate(booking.starts_at, tz)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Tổng tiền dự kiến</dt>
            <dd className="font-display text-2xl tabular">{formatVnd(booking.total_amount)}</dd>
          </div>
          {booking.deposit_amount > 0 && (
            <div>
              <dt className="text-sm text-muted">Tiền cọc</dt>
              <dd className="font-medium">{formatVnd(booking.deposit_amount)}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-4">
          {booking.hold_expires_at && !confirmed && (
            <div className="rounded-control bg-shuttle-soft p-4 text-shuttle-deep">
              <p className="text-sm">{showQr ? 'Chuyển khoản cọc trong' : 'Thời gian giữ chỗ còn lại'}</p>
              <Countdown until={booking.hold_expires_at} className="font-display text-4xl" expiredLabel="Đã hết thời gian giữ" />
            </div>
          )}
          <div className="text-sm leading-relaxed">
            {showQr ? (
              <p>
                {confirmed
                  ? 'Sân đã được giữ chắc chắn. Phần còn lại thanh toán tại quầy hoặc chuyển khoản bằng mã bên dưới.'
                  : 'Quét mã QR bên dưới để chuyển cọc. Tiền về là đơn tự được xác nhận, không cần chờ nhân viên gọi.'}
              </p>
            ) : paymentInstructions ? (
              <p className="whitespace-pre-line">{paymentInstructions}</p>
            ) : (
              <p>Chi nhánh sẽ gọi xác nhận trong thời gian giữ chỗ. Bạn có thể đặt cọc tại quầy hoặc theo hướng dẫn của nhân viên.</p>
            )}
            {hotline && (
              <p className="mt-2">
                Hotline:{' '}
                <a href={`tel:${hotline}`} className="font-medium underline underline-offset-4">
                  {formatPhone(hotline)}
                </a>
              </p>
            )}
          </div>
          {savedToAccount ? (
            <p className="flex items-start gap-2 rounded-control bg-court-soft px-3 py-2.5 text-sm text-court-deep">
              <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Đơn đã lưu vào tài khoản của bạn và sẽ được cộng điểm khi hoàn tất.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-control border border-dashed border-line px-3 py-2.5 text-sm">
              <p className="text-muted">Đơn đã được lưu trên thiết bị này — mở trang Tra cứu đơn là thấy ngay.</p>
              <p>
                <Link href="/register" className="font-semibold text-court-deep underline-offset-4 hover:underline">
                  Đăng ký thành viên
                </Link>{' '}
                để xem mọi đơn ở mọi thiết bị và tích điểm (nhập mã đơn này để cộng điểm).
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={savedToAccount ? `/account/bookings/${booking.code}` : `/booking/lookup?code=${booking.code}`}
              className={buttonClass('primary')}
            >
              {savedToAccount ? 'Xem trong tài khoản' : 'Tra cứu đơn'}
            </Link>
            <button type="button" onClick={onBookAnother} className={buttonClass('outline')}>
              Đặt thêm giờ khác
            </button>
          </div>
        </div>
      </div>
      {showQr && (
        <div className="border-t border-line p-4 sm:p-8">
          <DepositQr
            booking={booking}
            phone={phone}
            account={bank}
            onUpdate={setBooking}
            statusHref={savedToAccount ? `/account/bookings/${booking.code}` : `/booking/lookup?code=${booking.code}`}
          />
        </div>
      )}
    </section>
  );
}
