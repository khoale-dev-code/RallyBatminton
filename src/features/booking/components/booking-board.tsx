'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';

import { useInView } from '@/hooks/use-in-view';
import { formatVnd } from '@/lib/format';
import { addDays, isDateKey, zonedToUtc } from '@/lib/time';

import { createGuestHoldAction } from '../actions';
import { useBusySlots } from '../hooks/use-busy-slots';
import { useMinuteClock, useToday } from '../hooks/use-clock';
import { quoteSlots, ruleForSlot, upcomingDays, type PriceRuleLite } from '../lib/pricing';
import { rememberBooking } from '../lib/recent-bookings';
import { buildDaySlots, isBusy, nextSelection, selectionLength, slotWindow, type Selection } from '../lib/slots';
import { type BookingSummary } from '../schemas';

import { CourtTabs } from './court-tabs';
import { DateStrip } from './date-strip';
import { GuestForm, type GuestFormValues } from './guest-form';
import { HoldSuccess } from './hold-success';
import { SlotGrid, type SlotView } from './slot-grid';

export interface BoardBranch {
  id: string;
  name: string;
  timezone: string;
  opensAt: string;
  closesAt: string;
  slotMinutes: number;
  holdMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number;
  bookingWindowDays: number;
  depositPercent: number;
}

export interface BoardCourt {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'retired';
}

interface BookingBoardProps {
  branch: BoardBranch;
  courts: BoardCourt[];
  priceRules: PriceRuleLite[];
  turnstileSiteKey: string;
  paymentInstructions: string | null;
  hotline: string | null;
}

export function BookingBoard({ branch, courts, priceRules, turnstileSiteKey, paymentInstructions, hotline }: BookingBoardProps) {
  const tz = branch.timezone;
  const today = useToday(tz);
  const minute = useMinuteClock();

  const bookableCourts = courts.filter((c) => c.status === 'active');
  // Đến từ ô tìm giờ trống ở trang chủ: ?date=YYYY-MM-DD (chỉ nhận ngày hợp lệ trong cửa sổ đặt).
  const requestedDate = useSearchParams().get('date');
  const [pickedDate, setPickedDate] = useState<string | null>(() => (requestedDate && isDateKey(requestedDate) ? requestedDate : null));
  const [courtId, setCourtId] = useState<string | null>(bookableCourts[0]?.id ?? null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [result, setResult] = useState<BookingSummary | null>(null);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);
  const [summaryRef, summaryVisible] = useInView<HTMLElement>('0px 0px -80px 0px');

  const dateKey =
    pickedDate && today && pickedDate >= today && pickedDate <= addDays(today, branch.bookingWindowDays - 1) ? pickedDate : today;
  const days = useMemo(() => (today ? upcomingDays(today, branch.bookingWindowDays) : []), [today, branch.bookingWindowDays]);
  const slots = useMemo(
    () => buildDaySlots(branch.opensAt, branch.closesAt, branch.slotMinutes),
    [branch.opensAt, branch.closesAt, branch.slotMinutes],
  );
  const { busy, loading, failed, refresh } = useBusySlots(branch.id, dateKey, tz);

  const minSlots = Math.ceil(branch.minBookingMinutes / branch.slotMinutes);
  const maxSlots = Math.floor(branch.maxBookingMinutes / branch.slotMinutes);

  /** Trạng thái từng ô cho một sân. */
  const viewsFor = (targetCourt: string): SlotView[] => {
    if (!dateKey) return [];
    const nowMs = minute === null ? Number.POSITIVE_INFINITY : minute * 60000;
    return slots.map((slot) => {
      const window = slotWindow(dateKey, slot, tz);
      const rule = ruleForSlot(priceRules, targetCourt, dateKey, slot.start, branch.slotMinutes);
      const past = window.start <= nowMs;
      const taken = isBusy(busy, targetCourt, window);
      return {
        slot,
        state: past ? 'past' : taken ? 'busy' : rule === null ? 'unpriced' : 'free',
        pricePerHour: rule?.price_per_hour ?? null,
        selected:
          selection !== null && selection.courtId === targetCourt && slot.index >= selection.startIndex && slot.index <= selection.endIndex,
      };
    });
  };

  const currentViews = courtId ? viewsFor(courtId) : [];
  const freeCounts = Object.fromEntries(bookableCourts.map((c) => [c.id, viewsFor(c.id).filter((v) => v.state === 'free').length]));

  function pickSlot(index: number) {
    if (!courtId) return;
    setSubmitError(null);
    setSelection((current) =>
      nextSelection(current, courtId, index, {
        slotCount: slots.length,
        minSlots,
        maxSlots,
        isBlocked: (i) => currentViews[i]?.state !== 'free',
      }),
    );
  }

  const selectedSlots = selection ? slots.slice(selection.startIndex, selection.endIndex + 1) : [];
  const firstSlot = selectedSlots[0];
  const lastSlot = selectedSlots.at(-1);
  const quote =
    selection && dateKey
      ? quoteSlots(
          priceRules,
          selection.courtId,
          dateKey,
          selectedSlots.map((s) => s.start),
          branch.slotMinutes,
          branch.depositPercent,
        )
      : null;
  const durationMinutes = selection ? selectionLength(selection) * branch.slotMinutes : 0;
  const tooShort = selection !== null && durationMinutes < branch.minBookingMinutes;
  const selectedCourt = courts.find((c) => c.id === selection?.courtId);

  function submit(values: GuestFormValues) {
    if (!selection || !firstSlot || !lastSlot || !dateKey || tooShort) return;
    const startsAt = zonedToUtc(dateKey, firstSlot.start, tz).toISOString();
    const endsAt = zonedToUtc(dateKey, lastSlot.end, tz).toISOString();
    // Cùng lựa chọn + cùng thông tin → dùng lại khóa để gửi lại khi mạng chập chờn không tạo 2 đơn.
    const signature = [selection.courtId, startsAt, endsAt, values.phone, values.contactName].join('|');
    if (attemptRef.current?.signature !== signature) attemptRef.current = { signature, key: crypto.randomUUID() };
    const idempotencyKey = attemptRef.current.key;

    startTransition(async () => {
      setSubmitError(null);
      setFieldErrors({});
      try {
        const res = await createGuestHoldAction({ ...values, courtId: selection.courtId, startsAt, endsAt, idempotencyKey });
        if (res.ok) {
          setResult(res.booking);
          setSavedToAccount(res.savedToAccount);
          rememberBooking({
            code: res.booking.code,
            phone: values.phone,
            startsAt: res.booking.starts_at,
            branchName: branch.name,
            courtName: courts.find((c) => c.id === res.booking.court_id)?.name ?? '',
          });
          setSelection(null);
          refresh();
          return;
        }
        setSubmitError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setTurnstileReset((n) => n + 1);
        if (res.code === 'SLOT_TAKEN') {
          attemptRef.current = null;
          refresh();
        }
      } catch {
        setSubmitError('Mất kết nối khi gửi. Kiểm tra mạng rồi bấm gửi lại — đơn sẽ không bị tạo trùng.');
      }
    });
  }

  if (result) {
    return (
      <HoldSuccess
        booking={result}
        branchName={branch.name}
        courtName={courts.find((c) => c.id === result.court_id)?.name ?? ''}
        tz={tz}
        paymentInstructions={paymentInstructions}
        hotline={hotline}
        savedToAccount={savedToAccount}
        onBookAnother={() => setResult(null)}
      />
    );
  }

  if (bookableCourts.length === 0) {
    return (
      <p className="rounded-panel bg-hall p-6 text-muted">Chi nhánh tạm thời chưa có sân nhận đặt trực tuyến. Vui lòng gọi hotline.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DateStrip
        days={days}
        selected={dateKey}
        onSelect={(d) => {
          setPickedDate(d);
          setSelection(null);
        }}
      />

      <CourtTabs
        courts={courts}
        selected={courtId}
        freeCounts={loading ? null : freeCounts}
        onSelect={(id) => {
          setCourtId(id);
          setSelection((s) => (s?.courtId === id ? s : null));
        }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
          <p>
            Chạm giờ bắt đầu, rồi chạm giờ kết thúc. Mỗi ô {branch.slotMinutes} phút; tối thiểu {branch.minBookingMinutes / 60} giờ.
          </p>
          {failed && (
            <button type="button" onClick={refresh} className="font-medium text-shuttle-deep underline underline-offset-4">
              Không tải được lịch trống — thử lại
            </button>
          )}
        </div>
        <SlotGrid views={currentViews} loading={loading || !dateKey} onPick={pickSlot} />
      </div>

      {selection && firstSlot && lastSlot && quote ? (
        <section
          ref={summaryRef}
          id="thong-tin-dat-san"
          aria-labelledby="booking-summary-title"
          className="scroll-mt-24 rounded-panel border border-ink bg-paper p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p id="booking-summary-title" className="text-sm text-muted">
                  {selectedCourt?.name}
                </p>
                <p className="font-display text-3xl tabular">
                  {firstSlot.start}–{lastSlot.end}
                </p>
                <p className="text-sm text-muted">{durationMinutes / 60} giờ</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl tabular">{quote.complete ? formatVnd(quote.total) : '—'}</p>
                {quote.complete && quote.deposit > 0 && <p className="text-sm text-muted">Đặt cọc {formatVnd(quote.deposit)}</p>}
              </div>
            </div>
            {tooShort ? (
              <p className="text-sm text-amber-deep">Chọn thêm giờ kết thúc — tối thiểu {branch.minBookingMinutes} phút.</p>
            ) : (
              <GuestForm
                turnstileSiteKey={turnstileSiteKey}
                holdMinutes={branch.holdMinutes}
                pending={isPending}
                error={submitError}
                fieldErrors={fieldErrors}
                turnstileReset={turnstileReset}
                onSubmit={submit}
              />
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-panel border border-line bg-hall p-4 text-muted sm:p-5">
          Chưa chọn giờ. Giá hiển thị theo giờ, cọc {branch.depositPercent}% khi xác nhận.
        </p>
      )}

      {/* Thanh tóm tắt nhỏ, luôn trong tầm mắt trên điện thoại; form đầy đủ nằm trong luồng trang để không che nội dung. */}
      {selection && firstSlot && lastSlot && quote && !summaryVisible && (
        <a
          href="#thong-tin-dat-san"
          className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-panel bg-ink px-4 py-3 text-paper shadow-lift md:hidden"
        >
          <span className="tabular">
            {selectedCourt?.name}, {firstSlot.start}–{lastSlot.end}
          </span>
          <span className="font-display text-xl tabular">{quote.complete ? formatVnd(quote.total) : '—'}</span>
        </a>
      )}
    </div>
  );
}
