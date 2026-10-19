'use client';

import { Minus, PackageX, Plus, ScanBarcode, X } from 'lucide-react';
import { type KeyboardEvent, type Ref } from 'react';

import { MediaImage } from '@/components/brand/media-image';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import { stockLevel, unitCaption, type PosItem } from '../lib/cart';

interface CatalogToolbarProps {
  ref?: Ref<HTMLInputElement>;
  query: string;
  onQuery: (q: string) => void;
  onEnter: () => void;
  inStockOnly: boolean;
  onInStockOnly: (v: boolean) => void;
  categories: Array<{ id: string | null; name: string; count: number }>;
  category: string | null;
  onCategory: (id: string | null) => void;
}

/** Thanh tìm món (gõ không dấu, SKU, quét mã vạch) + lọc nhóm, dính đầu cột khi cuộn. */
export function CatalogToolbar({
  ref,
  query,
  onQuery,
  onEnter,
  inStockOnly,
  onInStockOnly,
  categories,
  category,
  onCategory,
}: CatalogToolbarProps) {
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      onQuery('');
    }
  }
  return (
    <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 bg-[color-mix(in_srgb,var(--color-hall)_50%,var(--color-paper))] px-4 pt-2 pb-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:px-0">
      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Tìm món, SKU hoặc quét mã vạch</span>
          <ScanBarcode aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={ref}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Tìm món, SKU, mã vạch"
            className="min-h-12 w-full rounded-control border border-line bg-paper pr-20 pl-11 text-base shadow-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Xóa từ khóa"
              className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-control text-muted hover:bg-hall hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line bg-hall px-1.5 font-sans text-xs text-muted [@media(pointer:fine)]:block">
              /
            </kbd>
          )}
        </label>
        <button
          type="button"
          aria-pressed={inStockOnly}
          onClick={() => onInStockOnly(!inStockOnly)}
          className={cn(
            'min-h-12 shrink-0 rounded-control border px-3 text-sm whitespace-nowrap',
            inStockOnly ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
          )}
        >
          Còn hàng
        </button>
      </div>
      {categories.length > 2 && (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Nhóm hàng">
          {categories.map((c) => (
            <button
              key={c.id ?? 'all'}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => onCategory(c.id)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap',
                category === c.id ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
              )}
            >
              {c.name}
              <span className={cn('text-xs tabular', category === c.id ? 'text-paper/70' : 'text-muted')}>{c.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TINTS = ['bg-court-soft text-court-deep', 'bg-amber-soft text-amber-deep', 'bg-shuttle-soft text-shuttle-deep', 'bg-hall text-ink'];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
}

function tintOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length] ?? TINTS[0]!;
}

interface ProductGridProps {
  items: PosItem[];
  quantityOf: (key: string) => number;
  maxOf: (item: PosItem) => number;
  onAdd: (item: PosItem) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  emptyMessage: string;
}

/** Lưới món: chạm để thêm; món đã có trong đơn hiện nút − + ngay trên thẻ. */
export function ProductGrid({ items, quantityOf, maxOf, onAdd, onSetQuantity, emptyMessage }: ProductGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line bg-paper px-6 py-12 text-center">
        <PackageX className="size-8 text-muted" aria-hidden />
        <p className="max-w-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const qty = quantityOf(item.key);
        const level = stockLevel(item);
        const maxed = qty >= maxOf(item);
        const unit = unitCaption(item);
        const label = `${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ''}${unit ? `, ${unit}` : ''}, ${formatVnd(item.price)}`;
        return (
          <li
            key={item.key}
            className={cn(
              'relative flex flex-col overflow-hidden rounded-panel border bg-paper transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none',
              qty > 0 ? 'border-court shadow-[0_0_0_1px_var(--color-court)]' : 'border-line hover:border-ink/40',
              level === 'out' && 'opacity-60',
            )}
          >
            <button
              type="button"
              onClick={() => onAdd(item)}
              disabled={level === 'out' || maxed}
              aria-label={level === 'out' ? `${label}, hết hàng` : `Thêm ${label}`}
              className="absolute inset-0 z-0 rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-ink/5 disabled:cursor-not-allowed"
            />
            <div className="pointer-events-none relative">
              {item.cover ? (
                <MediaImage path={item.cover} alt="" className="aspect-[4/3] w-full" sizes="(min-width: 1280px) 200px, 45vw" />
              ) : (
                <div className={cn('grid aspect-[4/3] w-full place-items-center font-display text-3xl', tintOf(item.name))} aria-hidden>
                  {initials(item.name)}
                </div>
              )}
              <span
                className={cn(
                  'absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium tabular shadow-sm',
                  level === 'out'
                    ? 'bg-shuttle-deep text-paper'
                    : level === 'low'
                      ? 'bg-amber-soft text-amber-deep'
                      : 'bg-paper/90 text-ink',
                )}
              >
                {level === 'out'
                  ? 'Hết hàng'
                  : `${level === 'low' ? 'Sắp hết: ' : 'Còn '}${item.onHand}${item.unitId && item.unitName ? ` ${item.unitName.toLowerCase()}` : ''}`}
              </span>
              {qty > 0 && (
                <span className="absolute top-2 right-2 grid min-w-8 place-items-center rounded-full bg-court-deep px-2 py-1 font-display text-paper tabular">
                  {qty}
                </span>
              )}
            </div>
            <div className="pointer-events-none flex flex-1 flex-col gap-0.5 p-3">
              <span className="line-clamp-2 leading-snug font-medium">{item.name}</span>
              {item.variantLabel && <span className="text-sm text-muted">{item.variantLabel}</span>}
              {unit && <span className="mt-0.5 self-start rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-paper">{unit}</span>}
              <span className="mt-auto pt-1.5 font-display text-lg whitespace-nowrap tabular">
                {formatVnd(item.price)}
                {(item.unitId ? item.unitName : item.unitLabel) && (
                  <span className="font-sans text-xs text-muted"> /{(item.unitId ? item.unitName : item.unitLabel)?.toLowerCase()}</span>
                )}
              </span>
            </div>
            {qty > 0 && (
              <div className="relative z-10 flex items-center justify-between border-t border-line bg-court-soft/50 p-1">
                <button
                  type="button"
                  onClick={() => onSetQuantity(item.key, qty - 1)}
                  aria-label={`Bớt một ${item.name}`}
                  className="grid size-10 place-items-center rounded-control hover:bg-paper"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="font-display text-lg tabular" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => onSetQuantity(item.key, qty + 1)}
                  disabled={maxed}
                  aria-label={`Thêm một ${item.name}`}
                  className="grid size-10 place-items-center rounded-control hover:bg-paper disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
