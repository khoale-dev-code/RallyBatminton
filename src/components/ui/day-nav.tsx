import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { addDays } from '@/lib/time';

import { buttonClass } from './button';

interface PeriodNavProps {
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
  currentHref: string;
  currentLabel: string;
  /** Nội dung thêm bên phải (ví dụ ô chọn ngày). */
  children?: ReactNode;
}

/** Điều hướng kỳ (ngày/tuần/tháng) gọn trên điện thoại: ‹ › là nút vuông 44px, nhãn đầy đủ cho trình đọc màn hình. */
export function PeriodNav({ prevHref, nextHref, prevLabel, nextLabel, currentHref, currentLabel, children }: PeriodNavProps) {
  const square = 'inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-line bg-paper hover:border-ink';
  return (
    <nav aria-label="Chọn kỳ" className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <Link href={prevHref} className={square} aria-label={prevLabel} title={prevLabel}>
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <Link href={currentHref} className={buttonClass('outline', 'md', 'min-h-11 px-4')}>
          {currentLabel}
        </Link>
        <Link href={nextHref} className={square} aria-label={nextLabel} title={nextLabel}>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>
      {children}
    </nav>
  );
}

/** Điều hướng theo ngày, giữ trạng thái trên URL (?date=YYYY-MM-DD). */
export function DayNav({ basePath, dateKey }: { basePath: string; dateKey: string }) {
  return (
    <PeriodNav
      prevHref={`${basePath}?date=${addDays(dateKey, -1)}`}
      nextHref={`${basePath}?date=${addDays(dateKey, 1)}`}
      prevLabel="Ngày trước"
      nextLabel="Ngày sau"
      currentHref={basePath}
      currentLabel="Hôm nay"
    >
      <form action={basePath} className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <label htmlFor="day-nav-date" className="sr-only">
          Chọn ngày
        </label>
        <input
          id="day-nav-date"
          type="date"
          name="date"
          defaultValue={dateKey}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-paper px-3 sm:w-44 sm:flex-none"
        />
        <button type="submit" className={buttonClass('ghost', 'md', 'min-h-11')}>
          Xem
        </button>
      </form>
    </PeriodNav>
  );
}
