'use client';

import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { Countdown } from '@/components/ui/interactive';
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
  onBookAnother: () => void;
}

export function HoldSuccess({
  booking,
  branchName,
  courtName,
  tz,
  paymentInstructions,
  hotline,
  savedToAccount = false,
  onBookAnother,
}: HoldSuccessProps) {
  return (
    <section className="animate-fade overflow-hidden rounded-panel border border-ink" aria-labelledby="hold-title">
      <div className="bg-court px-5 py-6 sm:px-8">
        <p id="hold-title" className="text-sm">
          Đã giữ sân. Mã đơn của bạn
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
          {booking.hold_expires_at && (
            <div className="rounded-control bg-shuttle-soft p-4 text-shuttle-deep">
              <p className="text-sm">Thời gian giữ chỗ còn lại</p>
              <Countdown until={booking.hold_expires_at} className="font-display text-4xl" expiredLabel="Đã hết thời gian giữ" />
            </div>
          )}
          <div className="text-sm leading-relaxed">
            {paymentInstructions ? (
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
    </section>
  );
}
