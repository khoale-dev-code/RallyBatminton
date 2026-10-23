'use client';

import { ArrowRight, History, MonitorSmartphone, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { useMember } from '@/features/member/hooks/use-member';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';

import { useMinuteClock } from '../hooks/use-clock';
import { bookingWhen } from '../lib/lookup-view';
import {
  forgetAllBookings,
  forgetBooking,
  loadRecentBookings,
  sortRecentBookings,
  subscribeRecentBookings,
  type RecentBooking,
} from '../lib/recent-bookings';

const EMPTY: RecentBooking[] = [];

export function useRecentBookings(): RecentBooking[] {
  return useSyncExternalStore(subscribeRecentBookings, loadRecentBookings, () => EMPTY);
}

/** Che bớt SĐT khi hiển thị trên thiết bị dùng chung: 0912 *** 678. */
function maskPhone(phone: string): string {
  const f = formatPhone(phone);
  return f.length >= 12 ? `${f.slice(0, 4)} *** ${f.slice(-3)}` : f;
}

/** Đơn đã đặt / tra cứu trên thiết bị này — bấm để xem lại, không cần nhớ mã. */
export function RecentBookings({ onOpen }: { onOpen: (b: RecentBooking) => void }) {
  const list = useRecentBookings();
  const minute = useMinuteClock();
  const member = useMember();
  const sorted = minute === null ? list : sortRecentBookings(list, minute * 60000);

  return (
    <div className="rally-lookup-recent flex flex-col gap-4">
      {member.status === 'member' ? (
        <Link
          href="/account/bookings"
          className="flex items-center gap-3 rounded-panel border border-court/40 bg-court-soft p-4 text-court-deep transition-colors hover:border-court"
        >
          <UserRound className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-sm">
            Bạn đang đăng nhập — <strong className="font-semibold">xem tất cả đơn trong tài khoản</strong>, không cần mã đơn.
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ) : member.status === 'guest' ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-panel border border-dashed border-line px-4 py-3 text-sm text-muted">
          <UserRound className="size-4 shrink-0" aria-hidden />
          Không nhớ mã đơn?
          <Link href="/login?next=/account/bookings" className="font-semibold text-court-deep underline-offset-4 hover:underline">
            Đăng nhập
          </Link>
          để xem mọi đơn trên mọi thiết bị, hoặc chọn đơn đã lưu trên máy này bên dưới.
        </p>
      ) : null}

      {sorted.length > 0 && (
        <section aria-labelledby="recent-title" className="flex flex-col gap-4">
          <header className="rally-lookup-listhead">
            <div>
              <p className="rally-lookup-smalllabel">ĐƠN ĐÃ XEM GẦN ĐÂY</p>
              <h2 id="recent-title">Đơn lưu trên thiết bị</h2>
              <p>Chọn một đơn để xem lại chi tiết và trạng thái.</p>
            </div>
            <MonitorSmartphone className="size-6 text-[#006341]" aria-hidden />
          </header>
          <ul className="rally-lookup-recent-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((b) => {
              const when = bookingWhen(b.startsAt, b.startsAt);
              const past = minute !== null && Date.parse(b.startsAt) < minute * 60000;
              return (
                <li key={b.code} className="relative rally-lookup-recent-item">
                  <button
                    type="button"
                    onClick={() => onOpen(b)}
                    className="rally-lookup-order group flex w-full items-center gap-3 rounded-panel border border-line bg-paper p-3 pr-11 text-left transition-shadow hover:shadow-lift"
                  >
                    <span
                      className={cn(
                        'rally-lookup-date flex w-14 shrink-0 flex-col items-center rounded-control py-1.5',
                        past ? 'bg-hall text-muted' : 'bg-ink text-paper',
                      )}
                    >
                      <span className="font-display text-2xl leading-none">{when.dayMonth.slice(0, 2)}</span>
                      <span className="text-[0.65rem]">Th {when.dayMonth.slice(3)}</span>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-display text-lg leading-tight tracking-wide">{b.code}</span>
                      <span className="truncate text-sm text-muted">
                        {when.timeRange.split(' – ')[0]} · {b.branchName}
                        {b.courtName ? ` · ${b.courtName}` : ''}
                      </span>
                      <span className="text-xs text-muted tabular">{maskPhone(b.phone)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => forgetBooking(b.code)}
                    aria-label={`Xóa đơn ${b.code} khỏi thiết bị này`}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-muted hover:bg-hall hover:text-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <p className="flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              Chỉ lưu trên trình duyệt của máy này, tự xóa 30 ngày sau giờ chơi. Dùng máy chung? Bấm ✕ để xóa sau khi xem.
            </p>
            <button type="button" onClick={forgetAllBookings} className="font-medium text-ink underline-offset-4 hover:underline">
              Xóa tất cả khỏi thiết bị này
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
