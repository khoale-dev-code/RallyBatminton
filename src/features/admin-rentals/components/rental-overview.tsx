import Link from 'next/link';

import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatDate, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { RENTAL_STATUS, RENTAL_USAGE } from '@/lib/labels';
import { formatSpan } from '@/lib/rental-fee';

import { rentalLiveState } from '../lib/rental-status';
import { type PriceBoardRow, type RentalBoardItem, type RentalHistoryItem } from '../types';

// ---------------------------------------------------------------------------
// Số liệu nhanh đầu trang
// ---------------------------------------------------------------------------
export function RentalStats({
  items,
  now,
  today,
}: {
  items: RentalBoardItem[];
  now: number;
  today: { revenue: number; lateFees: number; returned: number };
}) {
  const states = items.map((i) => ({ item: i, state: rentalLiveState(i, now) }));
  const late = states.filter((s) => s.state.phase === 'late');
  const soon = states.filter((s) => s.state.phase === 'soon' || s.state.phase === 'grace');
  const pieces = items.reduce((n, i) => n + i.quantity, 0);
  const onSite = items.filter((i) => i.usage === 'on_site').length;
  const lateFee = late.reduce((n, s) => n + s.state.overtime.fee, 0);

  const tiles = [
    {
      label: 'Đang cho thuê',
      value: `${items.length} phiếu`,
      hint: items.length ? `${pieces} món · ${onSite} tại sân, ${items.length - onSite} mang về` : 'Kho đồ thuê đang đủ',
      tone: 'default',
    },
    {
      label: 'Quá hạn trả',
      value: `${late.length} phiếu`,
      hint: late.length ? `Phụ phí tạm tính ${formatVnd(lateFee)}` : 'Không có phiếu trễ',
      tone: late.length ? 'red' : 'default',
    },
    {
      label: 'Sắp đến hạn',
      value: `${soon.length} phiếu`,
      hint: 'Trong 15 phút tới hoặc đang ân hạn',
      tone: soon.length ? 'amber' : 'default',
    },
    {
      label: 'Doanh thu thuê hôm nay',
      value: formatVnd(today.revenue),
      hint: today.lateFees ? `Gồm ${formatVnd(today.lateFees)} phụ phí trễ · ${today.returned} lượt trả` : `${today.returned} lượt đã trả`,
      tone: 'default',
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-panel border p-4',
            t.tone === 'red'
              ? 'border-shuttle/30 bg-shuttle-soft'
              : t.tone === 'amber'
                ? 'border-amber-deep/20 bg-amber-soft'
                : 'border-line bg-paper',
          )}
        >
          <span className="text-sm text-muted">{t.label}</span>
          <span
            className={cn(
              'font-display text-2xl leading-tight break-words tabular sm:text-3xl',
              t.tone === 'red' && 'text-shuttle-deep',
              t.tone === 'amber' && 'text-amber-deep',
            )}
          >
            {t.value}
          </span>
          <span className="text-xs leading-snug text-muted sm:text-sm">{t.hint}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bảng giá thuê (báo giá nhanh)
// ---------------------------------------------------------------------------
export function PriceBoard({ rows }: { rows: PriceBoardRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Chưa có đồ cho thuê nào có gói giá.</p>;
  const groups = [
    { key: 'on_site:duration', label: 'Tại sân' },
    { key: 'on_site:session', label: 'Hết trận' },
    { key: 'take_out:duration', label: 'Mang về' },
  ] as const;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((p) => (
        <li key={p.productId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <Link href={`/admin/catalog/${p.productId}`} className="font-medium hover:underline">
            {p.name}
            {p.isBundle && <span className="text-sm font-normal text-muted"> (combo)</span>}
          </Link>
          <dl className="flex flex-col gap-1 text-sm">
            {groups.map((g) => {
              const rates = p.rates.filter((r) => `${r.usage}:${r.billing}` === g.key);
              if (rates.length === 0) return null;
              return (
                <div key={g.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-muted">{g.label}</dt>
                  <dd className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {rates.map((r) => (
                      <span key={r.id} className="whitespace-nowrap">
                        {g.key === 'on_site:session' ? '' : `${r.label} `}
                        <span className="font-medium tabular">{formatVnd(r.price)}</span>
                      </span>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Giải thích cách tính phụ phí (để nhân viên nói lại với khách)
// ---------------------------------------------------------------------------
export function OvertimePolicyCard() {
  // Ví dụ trực quan: thuê 1 giờ, ân hạn 10 phút, block 30 phút, trả sau 2 giờ.
  const segments = [
    { label: 'Giờ thuê', minutes: 60, className: 'bg-court' },
    { label: 'Ân hạn', minutes: 10, className: 'bg-amber-deep/50' },
    { label: 'Tính phụ phí', minutes: 50, className: 'bg-shuttle' },
  ];
  const total = segments.reduce((n, s) => n + s.minutes, 0);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <ol className="flex flex-col gap-2.5">
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-hall font-display text-xs">1</span>
          <span>
            <strong className="font-medium">Ân hạn:</strong> trả trễ trong ân hạn không tính phí (tại sân 10 phút, hết trận 15 phút, mang về
            30–60 phút).
          </span>
        </li>
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-hall font-display text-xs">2</span>
          <span>
            <strong className="font-medium">Quá ân hạn:</strong> tính theo block (thường 30 phút), <em>đếm từ giờ hẹn trả</em>, làm tròn
            lên, nhân số món.
          </span>
        </li>
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-hall font-display text-xs">3</span>
          <span>
            <strong className="font-medium">Hết trận:</strong> hạn trả là giờ kết thúc sân. Khách gia hạn sân thì hạn trả tự lùi theo.
          </span>
        </li>
      </ol>
      <figure className="flex flex-col gap-2 rounded-control bg-hall/70 p-3">
        <figcaption className="text-muted">Ví dụ: thuê vợt 1 giờ 30.000 ₫, 2 giờ sau mới trả</figcaption>
        <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
          {segments.map((s) => (
            <span key={s.label} className={s.className} style={{ width: `${(s.minutes / total) * 100}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted tabular">
          <span>14:00 giao</span>
          <span>15:00 hẹn trả</span>
          <span>16:00 trả</span>
        </div>
        <p>
          Trễ 60 phút → <strong className="font-medium">2 block × 15.000 ₫ = 30.000 ₫</strong>. Tổng khách trả 60.000 ₫.
        </p>
      </figure>
      <p className="text-xs text-muted">
        Giá block mặc định chia theo giá gói (gói 1 giờ 30.000 ₫ → 15.000 ₫ / 30 phút). Đổi ân hạn, block, giá block, trần phụ phí ở trang
        sản phẩm.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lịch sử trả gần đây
// ---------------------------------------------------------------------------
export function RentalHistory({ items }: { items: RentalHistoryItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Chưa có lượt trả trong 3 ngày qua.</p>;
  return (
    <div className="@container flex flex-col">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_7rem_7.5rem] gap-4 border-b border-line px-3 pb-2 text-xs font-medium tracking-wide text-muted uppercase @3xl:grid">
        <span>Khách thuê</span>
        <span>Đồ thuê</span>
        <span>Thời gian</span>
        <span className="text-right">Tiền thuê</span>
        <span className="text-right">Phụ phí</span>
        <span className="text-right">Tổng</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((r) => {
          const extra = r.lateFee + r.damageFee;
          const reduced = r.lateFee < r.lateFeeAuto;
          const usage = RENTAL_USAGE[r.usage];
          return (
            <li key={r.id}>
              <Link
                href={`/admin/rentals/${r.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-3 py-3 transition-colors hover:bg-hall/60 @3xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_7rem_7.5rem] @3xl:items-center"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{r.customerName}</span>
                  <span className="text-sm text-muted tabular">{formatPhone(r.customerPhone)}</span>
                </span>
                <span className="flex flex-col items-end gap-1 @3xl:hidden">
                  <span className="font-display text-lg tabular">{formatVnd(r.rentalFee + extra)}</span>
                  <Badge tone={RENTAL_STATUS[r.status].tone}>{RENTAL_STATUS[r.status].label}</Badge>
                </span>
                <span className="col-span-2 flex min-w-0 flex-col gap-1 @3xl:col-span-1">
                  <span>
                    {r.productName} <span className="text-muted tabular">× {r.quantity}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Badge tone={usage.tone}>{r.courtName ? `${usage.short} · ${r.courtName}` : usage.short}</Badge>
                    {r.rateLabel}
                  </span>
                </span>
                <span className="col-span-2 flex flex-col text-sm @3xl:col-span-1">
                  <span className="tabular">
                    {formatTime(r.startsAt)} → {r.returnedAt ? formatTime(r.returnedAt) : '—'}
                    <span className="text-muted"> · {formatDate(r.returnedAt ?? r.startsAt).slice(0, 5)}</span>
                  </span>
                  {r.lateMinutes !== null && r.lateMinutes > 0 ? (
                    <span className={cn('text-xs', r.lateFee > 0 ? 'text-shuttle-deep' : 'text-amber-deep')}>
                      Trễ {formatSpan(r.lateMinutes)}
                      {r.lateFee === 0 && !reduced ? ' (trong ân hạn)' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-court-deep">{r.status === 'returned' ? 'Đúng hạn' : ''}</span>
                  )}
                </span>
                <span className="hidden text-right tabular @3xl:block">{formatVnd(r.rentalFee)}</span>
                <span className="col-span-2 flex flex-wrap items-center gap-x-3 text-sm @3xl:col-span-1 @3xl:flex-col @3xl:items-end @3xl:gap-0">
                  <span className={cn('tabular', extra > 0 ? 'text-shuttle-deep' : 'text-muted')}>
                    <span className="@3xl:hidden">Phụ phí: </span>
                    {extra > 0 ? `+${formatVnd(extra)}` : '—'}
                  </span>
                  {reduced && <span className="text-xs text-amber-deep">đã giảm từ {formatVnd(r.lateFeeAuto)}</span>}
                  {r.damageFee > 0 && <span className="text-xs text-muted">gồm {formatVnd(r.damageFee)} hư hỏng</span>}
                </span>
                <span className="hidden flex-col items-end gap-1 @3xl:flex">
                  <span className="font-display text-lg tabular">{formatVnd(r.rentalFee + extra)}</span>
                  <Badge tone={RENTAL_STATUS[r.status].tone}>{RENTAL_STATUS[r.status].label}</Badge>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
