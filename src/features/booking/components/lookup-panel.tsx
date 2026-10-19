'use client';

import { Info, Search, Smartphone, Ticket } from 'lucide-react';
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { cancelGuestBookingAction, lookupBookingAction, type LookupState } from '../actions';
import { rememberBooking, type RecentBooking } from '../lib/recent-bookings';

import { BookingTicket } from './booking-ticket';
import { LookupHelp } from './lookup-help';
import { RecentBookings } from './recent-bookings';

const initial: LookupState = { status: 'idle' };

const inputClass =
  'min-h-12 w-full rounded-control border border-line bg-paper pr-3 pl-11 transition-colors placeholder:text-muted/60 focus:border-court-strong focus:ring-4 focus:ring-court/20 focus:outline-none aria-[invalid=true]:border-shuttle-deep';

function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{children}</span>;
}

interface LookupPanelProps {
  defaultCode: string;
  hotline: string | null;
  intro: ReactNode;
}

export function LookupPanel({ defaultCode, hotline, intro }: LookupPanelProps) {
  const [lookup, lookupAction, looking] = useActionState(lookupBookingAction, initial);
  const [cancel, cancelAction, cancelling] = useActionState(cancelGuestBookingAction, initial);
  const codeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Kết quả hủy chỉ áp vào đúng đơn đang xem (tránh hiện đơn cũ sau khi tra đơn khác).
  const sameBooking = Boolean(cancel.booking && lookup.booking && cancel.booking.code === lookup.booking.code);
  const booking = sameBooking ? (cancel.booking ?? null) : (lookup.booking ?? null);
  const phone = (sameBooking ? cancel.phone : lookup.phone) ?? '';
  const bookingCode = booking?.code ?? null;

  useEffect(() => {
    if (!bookingCode || !resultRef.current) return;
    if (resultRef.current.getBoundingClientRect().top > window.innerHeight * 0.75) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [bookingCode, lookup]);

  // Tra cứu thành công → nhớ đơn trên thiết bị để lần sau bấm là xem, không cần gõ lại.
  useEffect(() => {
    const found = lookup.booking;
    if (lookup.status !== 'success' || !found || !lookup.phone) return;
    rememberBooking({
      code: found.code,
      phone: lookup.phone,
      startsAt: found.starts_at,
      branchName: found.branch_name ?? '',
      courtName: found.court_name ?? '',
    });
  }, [lookup]);

  const openRecent = (b: RecentBooking) => {
    if (codeRef.current) codeRef.current.value = b.code;
    if (phoneRef.current) phoneRef.current.value = b.phone;
    const data = new FormData();
    data.set('code', b.code);
    data.set('phone', b.phone);
    startTransition(() => lookupAction(data));
  };

  const lookupAnother = () => {
    const input = codeRef.current;
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
    input.select();
  };

  return (
    <>
      {/* PHẦN ĐẦU: giới thiệu + ô tra cứu ---------------------------------- */}
      <section aria-labelledby="lookup-title" className="full-bleed relative isolate overflow-hidden bg-ink text-paper">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgb(98_187_70/0.35),transparent_60%),radial-gradient(30rem_20rem_at_0%_110%,rgb(98_187_70/0.18),transparent_70%)]"
        />
        <svg
          aria-hidden
          viewBox="0 0 610 268"
          className="absolute top-1/2 -right-40 -z-10 hidden w-[52rem] -translate-y-1/2 -rotate-12 text-court opacity-25 lg:block"
        >
          <rect x="4" y="4" width="602" height="260" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M4 24 H606 M4 244 H606 M305 4 V264 M215 4 V264 M395 4 V264 M40 4 V264 M570 4 V264 M40 134 H215 M395 134 H570"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>

        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-16 lg:py-20">
          {intro}

          <form
            action={lookupAction}
            onSubmit={(e) => {
              // Gửi thủ công để ô nhập giữ nguyên giá trị sau khi tra cứu.
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              startTransition(() => lookupAction(data));
            }}
            noValidate
            className="flex flex-col gap-4 rounded-[1.25rem] bg-paper p-5 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] ring-1 ring-paper/10 sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">Nhập thông tin đơn</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span aria-hidden className="size-2 rounded-full bg-court" />
                Bảo mật
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code" className="text-sm font-medium">
                Mã đơn
              </label>
              <div className="relative">
                <FieldIcon>
                  <Ticket className="size-5" aria-hidden />
                </FieldIcon>
                <input
                  ref={codeRef}
                  id="code"
                  name="code"
                  defaultValue={defaultCode}
                  placeholder="RB-XXXXXXXX"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(lookup.fieldErrors?.code)}
                  aria-describedby={lookup.fieldErrors?.code ? 'code-error' : undefined}
                  className={cn(inputClass, 'font-display text-xl tracking-wider uppercase placeholder:normal-case')}
                />
              </div>
              {lookup.fieldErrors?.code && (
                <p id="code-error" className="text-sm text-shuttle-deep">
                  {lookup.fieldErrors.code}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                Số điện thoại đã đặt
              </label>
              <div className="relative">
                <FieldIcon>
                  <Smartphone className="size-5" aria-hidden />
                </FieldIcon>
                <input
                  ref={phoneRef}
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="09xx xxx xxx"
                  autoFocus={defaultCode.length > 0}
                  aria-invalid={Boolean(lookup.fieldErrors?.phone)}
                  aria-describedby={lookup.fieldErrors?.phone ? 'phone-error' : undefined}
                  className={cn(inputClass, 'text-[1.05rem] tabular')}
                />
              </div>
              {lookup.fieldErrors?.phone && (
                <p id="phone-error" className="text-sm text-shuttle-deep">
                  {lookup.fieldErrors.phone}
                </p>
              )}
            </div>
            {lookup.status === 'error' && !lookup.fieldErrors && (
              <p role="alert" className="rounded-control border-l-4 border-shuttle bg-shuttle-soft px-3 py-2.5 text-sm text-shuttle-deep">
                {lookup.message}
              </p>
            )}
            <button type="submit" disabled={looking} className={buttonClass('brand', 'lg', 'mt-1 w-full')}>
              <Search className="size-5" aria-hidden />
              {looking ? 'Đang tìm đơn…' : 'Tra cứu đơn'}
            </button>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              Quên mã? Chọn đơn đã lưu trên máy này ở bên dưới, đăng nhập tài khoản thành viên, hoặc gọi hotline.
            </p>
          </form>
        </div>
      </section>

      {/* KẾT QUẢ hoặc HƯỚNG DẪN ------------------------------------------- */}
      <div ref={resultRef} aria-live="polite" className="scroll-mt-24 pt-10 sm:pt-14">
        {booking ? (
          <section aria-label={`Đơn ${booking.code}`}>
            <BookingTicket
              key={booking.code}
              booking={booking}
              phone={phone}
              hotline={hotline}
              cancelAction={cancelAction}
              cancelling={cancelling}
              cancelError={sameBooking && cancel.status === 'error' ? (cancel.message ?? null) : null}
              cancelled={sameBooking && cancel.status === 'success'}
              onLookupAnother={lookupAnother}
            />
          </section>
        ) : (
          <div className="flex flex-col gap-10">
            <RecentBookings onOpen={openRecent} />
            <LookupHelp hotline={hotline} />
          </div>
        )}
      </div>
    </>
  );
}
