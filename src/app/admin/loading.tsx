export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Đang tải…</span>
      <div className="h-10 w-56 animate-pulse rounded-control bg-hall motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-panel bg-hall motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-panel bg-hall motion-reduce:animate-none" />
    </div>
  );
}
