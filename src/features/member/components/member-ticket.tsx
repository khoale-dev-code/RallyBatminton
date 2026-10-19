'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { BookingTicket } from '@/features/booking/components/booking-ticket';

import { memberCancelBookingAction, type MemberCancelState } from '../actions';
import { type MemberBooking } from '../schemas';

const initial: MemberCancelState = { status: 'idle' };

/** Vé đơn đặt sân trong tài khoản thành viên (hủy không cần nhập lại SĐT). */
export function MemberTicket({ booking, hotline }: { booking: MemberBooking; hotline: string | null }) {
  const [state, action, pending] = useActionState(memberCancelBookingAction, initial);
  const current = state.booking ?? booking;
  return (
    <BookingTicket
      booking={current}
      phone={current.contact_phone ?? ''}
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
    />
  );
}
