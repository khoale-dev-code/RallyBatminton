import { ChevronDown, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface CatalogFiltersProps {
  basePath: '/products' | '/rentals';
  categories: Array<{ slug: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  current: { q?: string; category?: string; branch?: string };
}

/** Lọc bằng form GET — chạy không cần JavaScript, URL chia sẻ được. */
export function CatalogFilters({ basePath, categories, branches, current }: CatalogFiltersProps) {
  const query = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: current.q, category: current.category, branch: current.branch, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors',
      active
        ? 'border-court-strong bg-court-strong font-medium text-paper shadow-sm'
        : 'border-line bg-paper hover:border-court-strong hover:text-court-deep',
    );
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8">
      <form action={basePath} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:gap-3">
        {current.category && <input type="hidden" name="category" value={current.category} />}
        <label htmlFor="catalog-q" className="sr-only">
          Tìm theo tên
        </label>
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="catalog-q"
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder="Tìm theo tên hoặc thương hiệu…"
            className="h-12 w-full rounded-control border border-line bg-paper pr-3 pl-12 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition-colors focus:border-ink focus-visible:ring-2 focus-visible:ring-ink/10"
          />
        </div>
        <label htmlFor="catalog-branch" className="sr-only">
          Chi nhánh
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink" aria-hidden />
          <select
            id="catalog-branch"
            name="branch"
            defaultValue={current.branch ?? ''}
            className="h-12 w-full appearance-none rounded-control border border-line bg-paper pr-9 pl-10 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none focus:border-ink"
          >
            <option value="">Mọi chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        </div>
        <button type="submit" className={buttonClass('primary', 'lg', 'h-12 min-h-12 px-5')}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Lọc
        </button>
      </form>
      {categories.length > 0 && (
        <nav aria-label="Nhóm hàng" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            href={query({ category: undefined })}
            aria-current={!current.category ? 'page' : undefined}
            className={chip(!current.category)}
          >
            Tất cả
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={query({ category: c.slug })}
              aria-current={current.category === c.slug ? 'page' : undefined}
              className={chip(current.category === c.slug)}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function Pagination({
  basePath,
  page,
  totalPages,
  params,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass('outline')}>
          Trang trước
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted tabular">
        Trang {page}/{totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={buttonClass('outline')}>
          Trang sau
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
