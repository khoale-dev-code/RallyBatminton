import { ReceiptText } from 'lucide-react';
import Link from 'next/link';

import { DrawerButton } from '@/features/desktop/components/drawer-button';
import { formatVnd } from '@/lib/format';

interface PosHeaderProps {
  branchName: string;
  cashierName: string;
  dateLabel: string;
  todayCount: number;
  todayRevenue: number;
}

/** Dải đầu quầy: chi nhánh, thu ngân, số đơn và doanh thu hôm nay. */
export function PosHeader({ branchName, cashierName, dateLabel, todayCount, todayRevenue }: PosHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-panel bg-ink px-4 py-3 text-paper sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h1 className="font-display text-2xl leading-tight">Quầy bán {branchName}</h1>
        <p className="truncate text-sm text-paper/70">
          {dateLabel}. Thu ngân: {cashierName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <dl className="flex flex-1 items-stretch gap-2 sm:flex-none">
          <div className="flex-1 rounded-control bg-paper/10 px-3 py-1.5 sm:flex-none">
            <dt className="text-xs text-paper/70">Đơn hôm nay</dt>
            <dd className="font-display text-xl leading-tight tabular">{todayCount}</dd>
          </div>
          <div className="flex-1 rounded-control bg-paper/10 px-3 py-1.5 sm:flex-none">
            <dt className="text-xs text-paper/70">Doanh thu</dt>
            <dd className="font-display text-xl leading-tight whitespace-nowrap tabular">{formatVnd(todayRevenue)}</dd>
          </div>
        </dl>
        <DrawerButton label="Ngăn kéo" className="border border-paper/25 hover:bg-paper/10" />
        <Link
          href="/admin/sales"
          aria-label="Xem đơn bán hôm nay"
          title="Đơn bán"
          className="grid size-12 shrink-0 place-items-center rounded-control border border-paper/25 hover:bg-paper/10"
        >
          <ReceiptText className="size-5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
