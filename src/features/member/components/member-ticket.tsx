'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { BookingTicket } from '@/features/booking/components/booking-ticket';
import { DepositQr } from '@/features/payments/components/deposit-qr';
import { type BankAccount } from '@/features/payments/lib/transfer';

import { memberCancelBookingAction, type MemberCancelState } from '../actions';
import { type MemberBooking } from '../schemas';

const initial: MemberCancelState = { status: 'idle' };

/** Vé đơn đặt sân trong tài khoản thành viên (hủy không cần nhập lại SĐT). */
export function MemberTicket({
  booking,
  hotline,
  account,
}: {
  booking: MemberBooking;
  hotline: string | null;
  account: BankAccount | null;
}) {
  const [state, action, pending] = useActionState(memberCancelBookingAction, initial);
  // Tiền chuyển khoản vừa về (trang tự hỏi lại) → cập nhật số đã trả / trạng thái ngay trên vé.
  const [live, setLive] = useState<MemberBooking | null>(null);
  const base = state.booking ?? booking;
  const current = live && live.code === base.code && !state.booking ? { ...base, ...live } : base;
  const phone = current.contact_phone ?? '';
  const showPayment =
    account !== null &&
    phone !== '' &&
    current.paid_amount < current.total_amount &&
    ['held', 'confirmed', 'checked_in'].includes(current.status);
  return (
    <BookingTicket
      booking={current}
      phone={phone}
      hotline={hotline}
      cancelAction={action}
      cancelling={pending}
      cancelError={state.status === 'error' ? (state.message ?? null) : null}
      cancelled={state.status === 'success'}
      extraAction={
        <Link href="/account/bookings" className={buttonClass('ghost', 'md')}>
          <ArrowLeft className="size-4" aria-hidden />
          Tất cả đơn
        </Link>
      }
      payment={
        showPayment && account ? (
          <DepositQr
            booking={current}
            phone={phone}
            account={account}
            statusHref={null}
            onUpdate={(next) => setLive({ ...current, ...next })}
          />
        ) : undefined
      }
    />
  );
}
