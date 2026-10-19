import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import { type CatalogItem } from '../queries';

import { ProductPlaceholder } from './product-placeholder';

function priceText(item: CatalogItem): string {
  const prefix = item.kind === 'rental' ? 'Thuê từ ' : item.minPrice !== item.maxPrice ? 'Từ ' : '';
  return `${prefix}${formatVnd(item.minPrice)}`;
}

function stockState(item: CatalogItem): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (item.available <= 0) return { text: item.kind === 'rental' ? 'Đang cho thuê hết' : 'Tạm hết hàng', tone: 'out' };
  if (item.available <= 3) return { text: `Chỉ còn ${item.available}`, tone: 'low' };
  return { text: item.kind === 'rental' ? 'Sẵn sàng cho thuê' : 'Còn hàng', tone: 'ok' };
}

const STOCK_TONE = {
  ok: { dot: 'bg-court', text: 'text-court-deep' },
  low: { dot: 'bg-amber-deep/70', text: 'text-amber-deep' },
  out: { dot: 'bg-muted/40', text: 'text-muted' },
} as const;

export function CatalogGrid({ items, basePath }: { items: CatalogItem[]; basePath: '/products' | '/rentals' }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
      {items.map((item) => {
        const stock = stockState(item);
        const discounted = item.kind === 'sale' && item.compareAtPrice !== null && item.compareAtPrice > item.minPrice;
        return (
          <li key={item.id}>
            <Link
              href={`${basePath}/${item.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="relative overflow-hidden">
                {item.coverPath ? (
                  <MediaImage
                    path={item.coverPath}
                    alt={item.name}
                    className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  />
                ) : (
                  <ProductPlaceholder name={item.name} category={item.categoryName} kind={item.kind} className="aspect-[4/3]" />
                )}
                {item.isBundle && (
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-paper">Combo</span>
                )}
                {discounted && (
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-shuttle px-2.5 py-0.5 text-xs font-semibold text-paper">
                    Giảm giá
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
                {item.categoryName && (
                  <span className="w-fit rounded-md bg-court-soft px-2 py-0.5 text-[0.7rem] font-medium text-court-deep sm:text-xs">
                    {item.categoryName}
                  </span>
                )}
                <span className="line-clamp-2 text-sm leading-snug font-medium sm:text-[0.95rem]">{item.name}</span>
                <span className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
                  <span className="text-base font-bold tabular sm:text-lg">{priceText(item)}</span>
                  {discounted && item.compareAtPrice !== null && (
                    <s className="text-xs text-muted tabular sm:text-sm">{formatVnd(item.compareAtPrice)}</s>
                  )}
                </span>
                <span className={cn('inline-flex items-center gap-1.5 text-xs sm:text-sm', STOCK_TONE[stock.tone].text)}>
                  <span aria-hidden className={cn('size-2 rounded-full', STOCK_TONE[stock.tone].dot)} />
                  {stock.text}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
