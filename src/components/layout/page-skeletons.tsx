import { CardGridSkeleton, HeadingSkeleton, LoadingShell, Skeleton, StatRowSkeleton, TableSkeleton } from '@/components/ui/skeleton';

/** Trang website chung: tiêu đề + lưới thẻ. */
export function SitePageSkeleton() {
  return (
    <LoadingShell className="flex flex-col gap-8 py-8 sm:py-12">
      <HeadingSkeleton />
      <CardGridSkeleton count={8} />
    </LoadingShell>
  );
}

/** Vật phẩm / Cho thuê: tiêu đề, điểm nổi bật, bộ lọc, lưới sản phẩm. */
export function CatalogSkeleton() {
  return (
    <LoadingShell className="flex flex-col gap-6 py-8 sm:py-12">
      <HeadingSkeleton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className={i > 0 ? 'hidden h-16 rounded-panel sm:block' : 'h-16 rounded-panel'} />
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <CardGridSkeleton count={8} />
    </LoadingShell>
  );
}

/** Chi tiết sản phẩm: ảnh + thông tin + chọn biến thể. */
export function ProductDetailSkeleton() {
  return (
    <LoadingShell className="grid gap-8 py-8 sm:py-12 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Skeleton className="aspect-square w-full rounded-panel" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-16 rounded-control" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-20" />
          ))}
        </div>
        <Skeleton className="h-12 w-full sm:w-56" />
      </div>
    </LoadingShell>
  );
}

/** Trang Chi nhánh: khối hero tối + thẻ chi nhánh. */
export function BranchesSkeleton() {
  return (
    <LoadingShell>
      <div className="full-bleed bg-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
          <Skeleton className="h-3.5 w-28 bg-paper/15" />
          <Skeleton className="h-12 w-3/4 max-w-lg bg-paper/15" />
          <Skeleton className="h-4 w-full max-w-xl bg-paper/10" />
        </div>
      </div>
      <div className="relative -mt-14 flex gap-4 overflow-hidden pb-12 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex w-[82%] shrink-0 flex-col gap-3 rounded-panel border border-line bg-paper p-3 shadow-lift sm:w-auto">
            <Skeleton className="aspect-[16/10] w-full rounded-[0.75rem]" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}

/** Đặt sân: tiêu đề, chọn chi nhánh, lưới giờ. */
export function BookingSkeleton() {
  return (
    <LoadingShell className="flex flex-col gap-8 py-8 sm:py-12">
      <HeadingSkeleton />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-[78%] shrink-0 rounded-panel sm:w-64" />
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-14 shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 24 }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    </LoadingShell>
  );
}

/** Tài khoản thành viên (phần nội dung; khung tab giữ nguyên). */
export function AccountSkeleton() {
  return (
    <LoadingShell className="flex flex-col gap-6">
      <Skeleton className="h-44 w-full rounded-panel" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-panel" />
        <Skeleton className="h-36 rounded-panel" />
      </div>
      <Skeleton className="h-56 rounded-panel" />
    </LoadingShell>
  );
}

/** Trang quản trị: tiêu đề + số liệu + bảng. */
export function AdminPageSkeleton() {
  return (
    <LoadingShell className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <StatRowSkeleton />
      <TableSkeleton rows={7} />
    </LoadingShell>
  );
}
