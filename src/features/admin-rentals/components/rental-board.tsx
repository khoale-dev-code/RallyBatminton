'use client';

import { Phone, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatPhone, formatTime, formatVnd } from '@/lib/format';
import { RENTAL_USAGE } from '@/lib/labels';
import { formatBlock } from '@/lib/rental-fee';

import { useNow } from '../hooks/use-now';
import { initials, rentalLiveState, type RentalLiveState } from '../lib/rental-status';
import { type RentalBoardItem } from '../types';

import { RentalTimeMeter } from './rental-time-meter';

type Filter = 'all' | 'late' | 'on_site' | 'take_out';

const ACCENT: Record<RentalLiveState['phase'], string> = {
  ok: 'bg-transparent',
  soon: 'bg-amber-deep/60',
  grace: 'bg-amber-deep/60',
  late: 'bg-shuttle',
};

interface Row {
  item: RentalBoardItem;
  state: RentalLiveState;
}

/** Bảng đồ đang cho thuê: ai thuê, thuê gì, hình thức, còn/trễ bao lâu, phụ phí tạm tính — cập nhật mỗi 15 giây. */
export function RentalBoard({ items, serverNow }: { items: RentalBoardItem[]; serverNow: number }) {
  const now = useNow(serverNow);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(
    () => items.map((item) => ({ item, state: rentalLiveState(item, now) })).sort((a, b) => a.state.minutesLeft - b.state.minutesLeft),
    [items, now],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      late: rows.filter((r) => r.state.phase === 'late' || r.state.phase === 'grace').length,
      on_site: rows.filter((r) => r.item.usage === 'on_site').length,
      take_out: rows.filter((r) => r.item.usage === 'take_out').length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    const digits = q.replace(/\D/g, '');
    return rows.filter(({ item, state }) => {
      if (filter === 'late' && state.phase !== 'late' && state.phase !== 'grace') return false;
      if ((filter === 'on_site' || filter === 'take_out') && item.usage !== filter) return false;
      if (!q) return true;
      return (
        item.customerName.toLocaleLowerCase('vi').includes(q) ||
        item.productName.toLocaleLowerCase('vi').includes(q) ||
        item.code.toLocaleLowerCase('vi').includes(q) ||
        (digits.length >= 3 && item.customerPhone.includes(digits))
      );
    });
  }, [rows, filter, query]);

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'late', label: 'Quá hạn' },
    { id: 'on_site', label: 'Tại sân' },
    { id: 'take_out', label: 'Mang về' },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div role="tablist" aria-label="Lọc phiếu thuê" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
                filter === t.id ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-hall',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular',
                  filter === t.id
                    ? 'bg-paper/20'
                    : t.id === 'late' && counts.late > 0
                      ? 'bg-shuttle-soft text-shuttle-deep'
                      : 'bg-hall text-muted',
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
        <label className="relative block @3xl:w-72">
          <span className="sr-only">Tìm khách, số điện thoại, mã phiếu</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm khách, SĐT, mã phiếu…"
            className="min-h-10 w-full rounded-full border border-line bg-paper pr-3 pl-9 text-sm outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-control bg-hall/70 px-4 py-6 text-center text-sm text-muted">
          {rows.length === 0 ? 'Không có đồ nào đang cho thuê.' : 'Không có phiếu khớp bộ lọc.'}
        </p>
      ) : (
        <div className="@container flex flex-col">
          <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_8.5rem_6.5rem] gap-4 border-b border-line px-3 pb-2 text-xs font-medium tracking-wide text-muted uppercase @3xl:grid">
            <span>Khách thuê</span>
            <span>Đồ thuê</span>
            <span>Thời gian</span>
            <span className="text-right">Phụ phí trễ</span>
            <span className="sr-only">Thao tác</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((row) => (
              <BoardRow key={row.item.id} row={row} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BoardRow({ row: { item, state } }: { row: Row }) {
  const unpaid = item.paid < item.rentalFee;
  const usage = RENTAL_USAGE[item.usage];
  const href = `/admin/rentals/${item.id}`;

  const customer = (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full font-display text-lg',
          state.phase === 'late' ? 'bg-shuttle-soft text-shuttle-deep' : 'bg-hall text-ink',
        )}
      >
        {initials(item.customerName)}
      </span>
      <span className="flex min-w-0 flex-col">
        <Link href={href} className="truncate font-medium hover:underline">
          {item.customerName}
        </Link>
        {item.customerPhone ? (
          <a
            href={`tel:${item.customerPhone}`}
            className="inline-flex items-center gap-1 text-sm whitespace-nowrap text-muted tabular hover:text-ink"
          >
            <Phone className="size-3.5" aria-hidden />
            {formatPhone(item.customerPhone)}
          </a>
        ) : null}
      </span>
    </div>
  );

  const product = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-medium">
        {item.productName} <span className="whitespace-nowrap text-muted tabular">× {item.quantity}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={usage.tone}>{item.courtName ? `${usage.short} · ${item.courtName}` : usage.short}</Badge>
        <span className="text-xs text-muted">
          {item.rateLabel}, {formatVnd(item.unitPrice)}/món
        </span>
      </span>
      {(item.collateral !== null || unpaid) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {item.collateral && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs">
              <ShieldCheck className="size-3.5 text-court-deep" aria-hidden />
              Cọc: {item.collateral}
            </span>
          )}
          {unpaid && <Badge tone="red">Chưa thu {formatVnd(item.rentalFee - item.paid)}</Badge>}
        </span>
      )}
    </div>
  );

  const fee =
    state.overtime.fee > 0 ? (
      <span className="flex flex-col items-end">
        <span className="font-display text-xl text-shuttle-deep tabular">+{formatVnd(state.overtime.fee)}</span>
        <span className="text-xs text-muted tabular">
          {state.overtime.blocks} × {formatVnd(item.policy.blockPrice)}
          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
          {state.overtime.capped ? ' (trần)' : ''}
        </span>
      </span>
    ) : (
      <span className="flex flex-col items-end">
        <span className={cn('font-display text-xl tabular', state.phase === 'grace' ? 'text-amber-deep' : 'text-muted')}>0 ₫</span>
        <span className={cn('text-xs whitespace-nowrap text-muted tabular', state.phase !== 'grace' && 'hidden @3xl:inline')}>
          {state.phase === 'grace'
            ? `Ân hạn đến ${formatTime(new Date(new Date(item.dueAt).getTime() + item.policy.graceMinutes * 60000))}`
            : `Trễ: ${formatVnd(item.policy.blockPrice)}/${formatBlock(item.policy.blockMinutes)}`}
        </span>
      </span>
    );

  const action = (
    <Link href={`${href}#nhan-tra`} className={buttonClass(state.phase === 'late' ? 'primary' : 'outline', 'sm', 'w-full @3xl:w-auto')}>
      Nhận trả
    </Link>
  );

  return (
    <li className="relative">
      <span aria-hidden className={cn('absolute top-3 bottom-3 left-0 w-1 rounded-full', ACCENT[state.phase])} />
      {/* Điện thoại / tablet: thẻ xếp dọc */}
      <div className="flex flex-col gap-3 py-4 pl-3 @3xl:hidden">
        <div className="flex items-start justify-between gap-3">
          {customer}
          {fee}
        </div>
        {product}
        <RentalTimeMeter startsAt={item.startsAt} dueAt={item.dueAt} state={state} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{item.code}</span>
          <div className="w-32">{action}</div>
        </div>
      </div>
      {/* Máy tính: hàng bảng */}
      <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_8.5rem_6.5rem] items-center gap-4 px-3 py-4 @3xl:grid">
        {customer}
        {product}
        <div className="flex flex-col gap-1">
          <RentalTimeMeter startsAt={item.startsAt} dueAt={item.dueAt} state={state} />
          <span className="text-xs text-muted">{item.code}</span>
        </div>
        {fee}
        {action}
      </div>
    </li>
  );
}
