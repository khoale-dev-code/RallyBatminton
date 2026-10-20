import { Skeleton } from '@/components/ui/skeleton';

/** Khung xương dạng lịch tuần — giữ đúng bố cục để trang không nhảy khi dữ liệu về. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Đang tải lịch ca" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-11 w-72" />
      <Skeleton className="h-12 w-full rounded-panel" />
      <div className="hidden overflow-hidden rounded-panel border border-line bg-paper md:block">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-line py-2">
          <span />
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="size-10 rounded-full" />
            </span>
          ))}
        </div>
        <div
          className="h-[34rem]"
          style={{ backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)', backgroundSize: '100% 48px' }}
        />
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full rounded-panel" />
      </div>
    </div>
  );
}
