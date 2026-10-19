import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { MediaImage } from '@/components/brand/media-image';
import { formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

import { type BranchSummary } from '../queries';

/** Danh sách chi nhánh dạng hàng có vạch kẻ — đọc nhanh: tên, địa chỉ, giờ, số sân, giá từ. */
export function BranchList({ branches, linkQuery = '' }: { branches: BranchSummary[]; linkQuery?: string }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {branches.map((b) => (
        <li key={b.id}>
          <Link
            href={`/branches/${b.slug}${linkQuery}`}
            className="group grid grid-cols-[88px_1fr] gap-4 py-5 transition-colors hover:bg-hall/60 sm:grid-cols-[140px_1fr_auto] sm:items-center sm:gap-6 sm:px-3"
          >
            <MediaImage path={b.coverImagePath} alt={b.name} className="aspect-[4/3] rounded-control" sizes="140px" />
            <div className="min-w-0">
              <h3 className="text-2xl group-hover:underline group-hover:decoration-court group-hover:decoration-2 group-hover:underline-offset-4">
                {b.name}
              </h3>
              <p className="mt-1 text-muted">
                {b.addressLine}
                {b.district ? `, ${b.district}` : ''}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="whitespace-nowrap">
                  Mở cửa{' '}
                  <span className="tabular">
                    {shortTime(b.opensAt)}–{shortTime(b.closesAt)}
                  </span>
                </span>
                <span className="whitespace-nowrap">{b.courtCount} sân</span>
                {b.minPrice !== null && (
                  <span className="whitespace-nowrap">
                    từ <span className="font-medium tabular">{formatVnd(b.minPrice)}</span>/giờ
                  </span>
                )}
              </p>
            </div>
            <span className={buttonClass('outline', 'md', 'col-span-2 sm:col-span-1')}>Xem giờ trống</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
