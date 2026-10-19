import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Khối giữ chỗ khi đang tải (nhấp nháy nhẹ; tắt khi người dùng giảm chuyển động). */
export function Skeleton({ className = '' }: { className?: string }) {
  // cn() không gộp lớp trùng nhóm, nên chỉ thêm bo góc / màu mặc định khi chưa truyền.
  const custom = className.split(/\s+/);
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse motion-reduce:animate-none',
        !custom.some((c) => c.startsWith('rounded')) && 'rounded-control',
        !custom.some((c) => c.startsWith('bg-')) && 'bg-line/50',
        className,
      )}
    />
  );
}

/** Vỏ chung: báo cho trình đọc màn hình đang tải, giữ bố cục để trang không nhảy khi có dữ liệu. */
export function LoadingShell({ children, className, label = 'Đang tải…' }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Tiêu đề trang (dòng nhỏ + tiêu đề lớn + mô tả). */
export function HeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-9 w-3/4 max-w-md sm:h-11" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

/** Lưới thẻ sản phẩm / chi nhánh. */
export function CardGridSkeleton({ count = 8, className, tall = false }: { count?: number; className?: string; tall?: boolean }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className={cn('w-full rounded-panel', tall ? 'aspect-[4/5]' : 'aspect-square')} />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      ))}
    </div>
  );
}

/** Bảng dữ liệu (admin): thanh công cụ + các dòng. */
export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-panel border border-line', className)}>
      <div className="flex items-center gap-3 border-b border-line bg-hall/60 px-4 py-3">
        <Skeleton className="h-4 w-28 bg-line/80" />
        <Skeleton className="ml-auto h-4 w-20 bg-line/80" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2 max-w-xs" />
            <Skeleton className="h-3 w-1/3 max-w-[10rem]" />
          </div>
          <Skeleton className="hidden h-4 w-20 sm:block" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Hàng số liệu tóm tắt (admin). */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-panel border border-line p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}
