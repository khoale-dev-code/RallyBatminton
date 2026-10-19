'use client';

import { ArrowLeft, Info, Search, Smartphone, Ticket } from 'lucide-react';
import { startTransition, useActionState, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';
import { DepositQr } from '@/features/payments/components/deposit-qr';
import { accountForBranch, type BankAccounts } from '@/features/payments/lib/transfer';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import {
  cancelGuestBookingAction,
  lookupBookingAction,
  lookupByPhoneAction,
  revealGuestBookingAction,
  type LookupState,
  type PhoneLookupState,
  type RevealState,
} from '../actions';
import { loadRecentBookings, rememberBooking, type RecentBooking } from '../lib/recent-bookings';
import { type BookingSummary } from '../schemas';

import { BookingTicket } from './booking-ticket';
import { LookupHelp } from './lookup-help';
import { PhoneBookingList } from './phone-booking-list';
import { RecentBookings } from './recent-bookings';
import { Turnstile } from './turnstile';

const initial: LookupState = { status: 'idle' };
const initialPhone: PhoneLookupState = { status: 'idle' };
const initialReveal: RevealState = { status: 'idle' };

type Mode = 'phone' | 'code';

const inputClass =
  'min-h-12 w-full rounded-control border border-line bg-paper pr-3 pl-11 transition-colors placeholder:text-muted/60 focus:border-court-strong focus:ring-4 focus:ring-court/20 focus:outline-none aria-[invalid=true]:border-shuttle-deep';

function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{children}</span>;
}

interface LookupPanelProps {
  defaultCode: string;
  hotline: string | null;
  intro: ReactNode;
  turnstileSiteKey: string;
  banks: BankAccounts;
}

export function LookupPanel({ defaultCode, hotline, intro, turnstileSiteKey, banks }: LookupPanelProps) {
  const [mode, setMode] = useState<Mode>(defaultCode ? 'code' : 'phone');
  const [lookup, lookupAction, looking] = useActionState(lookupBookingAction, initial);
  const [phoneSearch, phoneAction, searching] = useActionState(lookupByPhoneAction, initialPhone);
  const [reveal, revealAction, revealing] = useActionState(revealGuestBookingAction, initialReveal);
  const [cancel, cancelAction, cancelling] = useActionState(cancelGuestBookingAction, initial);
  const [token, setToken] = useState<string | null>(turnstileSiteKey ? null : 'dev-no-turnstile');
  const [turnstileReset, setTurnstileReset] = useState(0);
  // Bấm "Các đơn của số này" / "Tìm số khác": ẩn vé / danh sách đã xem (theo dấu thời gian kết quả).
  const [hiddenTicketAt, setHiddenTicketAt] = useState(0);
  const [hiddenListAt, setHiddenListAt] = useState(0);
  // Đơn được cập nhật tại chỗ (tiền chuyển khoản vừa về) — theo mã đơn.
  const [liveUpdates, setLiveUpdates] = useState<Record<string, BookingSummary>>({});
  const codeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const phoneOnlyRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Vé đang xem: kết quả mới nhất giữa "tra bằng mã" và "mở đơn bằng họ tên".
  const codeAt = lookup.status === 'success' && lookup.booking ? (lookup.nonce ?? 0) : 0;
  const revealAt = reveal.status === 'success' && reveal.booking ? (reveal.nonce ?? 0) : 0;
  const listAt = phoneSearch.status === 'success' ? (phoneSearch.nonce ?? 0) : 0;
  const ticketAt = Math.max(codeAt, revealAt);
  const ticketSource = revealAt > codeAt ? reveal : lookup;
  const showTicket = ticketAt > 0 && ticketAt > hiddenTicketAt && ticketAt > listAt;
  const ticketBooking = showTicket ? (ticketSource.booking ?? null) : null;
  const showList = !showTicket && listAt > hiddenListAt && phoneSearch.items !== undefined;

  // Kết quả hủy chỉ áp vào đúng đơn đang xem (tránh hiện đơn cũ sau khi tra đơn khác).
  const sameBooking = Boolean(cancel.booking && ticketBooking && cancel.booking.code === ticketBooking.code);
  const baseBooking = sameBooking ? (cancel.booking ?? null) : ticketBooking;
  const booking = baseBooking ? (liveUpdates[baseBooking.code] ?? baseBooking) : null;
  const account = booking ? accountForBranch(banks, booking.branch_id) : null;
  const owesMoney = booking !== null && booking.paid_amount < booking.total_amount;
  const showPayment = booking !== null && account !== null && owesMoney && ['held', 'confirmed', 'checked_in'].includes(booking.status);
  const phone = (sameBooking ? cancel.phone : ticketSource.phone) ?? '';
  const bookingCode = booking?.code ?? null;
  const resultKey = `${bookingCode ?? ''}|${showList ? listAt : 0}`;

  useEffect(() => {
    if (resultKey === '|0' || !resultRef.current) return;
    if (resultRef.current.getBoundingClientRect().top > window.innerHeight * 0.6) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [resultKey]);

  // Tra cứu / mở đơn thành công → nhớ đơn trên thiết bị để lần sau bấm là xem, không cần gõ lại.
  useEffect(() => {
    for (const result of [lookup, reveal]) {
      const found = result.booking;
      if (result.status !== 'success' || !found || !result.phone) continue;
      rememberBooking({
        code: found.code,
        phone: result.phone,
        startsAt: found.starts_at,
        branchName: found.branch_name ?? '',
        courtName: found.court_name ?? '',
      });
    }
  }, [lookup, reveal]);

  const openRecent = (b: RecentBooking) => {
    setMode('code');
    if (codeRef.current) codeRef.current.value = b.code;
    if (phoneRef.current) phoneRef.current.value = b.phone;
    const data = new FormData();
    data.set('code', b.code);
    data.set('phone', b.phone);
    startTransition(() => lookupAction(data));
  };

  // Mở từ nút "Xem trạng thái đơn" (?code=…) trên đúng thiết bị đã đặt → tự tra luôn, khách không phải gõ SĐT.
  const autoOpen = useEffectEvent(() => {
    if (!defaultCode) return;
    const saved = loadRecentBookings().find((b) => b.code === defaultCode.toUpperCase());
    if (!saved) return;
    if (phoneRef.current) phoneRef.current.value = saved.phone;
    const data = new FormData();
    data.set('code', saved.code);
    data.set('phone', saved.phone);
    startTransition(() => lookupAction(data));
  });
  useEffect(() => {
    autoOpen();
  }, []);

  const focusInput = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
    input.select();
  };

  const lookupAnother = () => focusInput(mode === 'phone' ? phoneOnlyRef.current : codeRef.current);

  const searchAnotherPhone = () => {
    setHiddenListAt(listAt);
    setHiddenTicketAt(ticketAt);
    setMode('phone');
    window.setTimeout(() => focusInput(phoneOnlyRef.current), 0);
  };

  const backToList = () => setHiddenTicketAt(ticketAt);

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

          <div className="flex flex-col gap-4 rounded-[1.25rem] bg-paper p-5 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] ring-1 ring-paper/10 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">Tìm đơn đặt sân</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span aria-hidden className="size-2 rounded-full bg-court" />
                Bảo mật
              </span>
            </div>
            <div role="tablist" aria-label="Cách tra cứu" className="grid grid-cols-2 gap-1 rounded-control bg-hall p-1">
              {(
                [
                  ['phone', 'Số điện thoại', Smartphone],
                  ['code', 'Mã đơn', Ticket],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.4rem] text-sm font-medium transition-colors',
                    mode === key ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <form
              action={phoneAction}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                data.set('turnstileToken', token ?? '');
                startTransition(() => phoneAction(data));
                // Mã chống bot chỉ dùng một lần: xin mã mới cho lần tìm sau.
                if (turnstileSiteKey) setTurnstileReset((n) => n + 1);
              }}
              noValidate
              className="flex flex-col gap-4"
              hidden={mode !== 'phone'}
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone-only" className="text-sm font-medium">
                  Số điện thoại đã dùng khi đặt
                </label>
                <div className="relative">
                  <FieldIcon>
                    <Smartphone className="size-5" aria-hidden />
                  </FieldIcon>
                  <input
                    ref={phoneOnlyRef}
                    id="phone-only"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="09xx xxx xxx"
                    aria-invalid={Boolean(phoneSearch.fieldErrors?.phone)}
                    aria-describedby={phoneSearch.fieldErrors?.phone ? 'phone-only-error' : undefined}
                    className={cn(inputClass, 'font-display text-xl tracking-wider tabular')}
                  />
                </div>
                {phoneSearch.fieldErrors?.phone && (
                  <p id="phone-only-error" className="text-sm text-shuttle-deep">
                    {phoneSearch.fieldErrors.phone}
                  </p>
                )}
              </div>
              {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setToken} resetSignal={turnstileReset} />}
              {phoneSearch.status === 'error' && !phoneSearch.fieldErrors?.phone && (
                <p role="alert" className="rounded-control border-l-4 border-shuttle bg-shuttle-soft px-3 py-2.5 text-sm text-shuttle-deep">
                  {phoneSearch.message}
                </p>
              )}
              <button type="submit" disabled={searching || !token} className={buttonClass('brand', 'lg', 'mt-1 w-full')}>
                <Search className="size-5" aria-hidden />
                {searching ? 'Đang tìm đơn…' : 'Tìm đơn của tôi'}
              </button>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <Info className="mt-px size-4 shrink-0" aria-hidden />
                Dành cho khách đặt không cần tài khoản. Xem đơn hôm nay, sắp tới và lịch sử đặt sân của số này.
              </p>
            </form>
            <form
              action={lookupAction}
              onSubmit={(e) => {
                // Gửi thủ công để ô nhập giữ nguyên giá trị sau khi tra cứu.
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                startTransition(() => lookupAction(data));
              }}
              noValidate
              className="flex flex-col gap-4"
              hidden={mode !== 'code'}
            >
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
                Quên mã? Chuyển sang tab Số điện thoại để xem các đơn đã đặt bằng số của bạn.
              </p>
            </form>
          </div>
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
              payment={
                showPayment && account ? (
                  booking.status === 'held' || booking.paid_amount < booking.deposit_amount ? (
                    <DepositQr
                      key={booking.code}
                      booking={booking}
                      phone={phone}
                      account={account}
                      statusHref={null}
                      onUpdate={(next) => setLiveUpdates((all) => ({ ...all, [next.code]: next }))}
                    />
                  ) : (
                    <details className="group rounded-panel border border-line bg-paper">
                      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-medium">
                        Chuyển khoản phần còn lại ({formatVnd(booking.total_amount - booking.paid_amount)})
                        <span className="text-sm text-muted group-open:hidden">Mở mã QR</span>
                      </summary>
                      <div className="border-t border-line p-3 sm:p-4">
                        <DepositQr
                          key={booking.code}
                          booking={booking}
                          phone={phone}
                          account={account}
                          statusHref={null}
                          collapseRemaining={false}
                          onUpdate={(next) => setLiveUpdates((all) => ({ ...all, [next.code]: next }))}
                        />
                      </div>
                    </details>
                  )
                ) : undefined
              }
              extraAction={
                phoneSearch.items && listAt > 0 ? (
                  <button type="button" onClick={backToList} className={buttonClass('outline', 'md')}>
                    <ArrowLeft className="size-4" aria-hidden />
                    Các đơn của số này
                  </button>
                ) : undefined
              }
            />
          </section>
        ) : showList && phoneSearch.phone ? (
          <PhoneBookingList
            phone={phoneSearch.phone}
            items={phoneSearch.items ?? []}
            memberBookings={phoneSearch.memberBookings ?? 0}
            hotline={hotline}
            revealAction={revealAction}
            reveal={reveal}
            revealing={revealing}
            onSearchAnother={searchAnotherPhone}
          />
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
