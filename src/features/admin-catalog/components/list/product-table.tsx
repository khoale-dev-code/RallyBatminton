import { Globe, Store } from 'lucide-react';
import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { Badge } from '@/components/ui/primitives';
import { formatVnd } from '@/lib/format';

import { type AdminProductRow } from '../../queries';

// Bảng nhiều cột chỉ khi đủ rộng (màn hình lớn); máy tính bảng dùng dạng thẻ để tên sản phẩm không bị bóp.
const GRID = 'xl:grid xl:grid-cols-[minmax(0,1fr)_8.5rem_7rem_9rem_7.5rem] xl:items-center xl:gap-4';

/** Số tiền không tách khỏi ký hiệu ₫ khi xuống dòng. */
const money = (n: number) => formatVnd(n).replace(' ', '\u00a0');

function priceText(p: AdminProductRow): string {
  if (p.kind === 'rental') return p.fromRate !== null ? `từ ${money(p.fromRate)}` : 'Chưa có giá';
  if (p.minPrice === null) return 'Chưa có giá';
  return p.maxPrice !== null && p.maxPrice !== p.minPrice ? `${money(p.minPrice)} – ${money(p.maxPrice)}` : money(p.minPrice);
}

function StatusBadge({ p }: { p: AdminProductRow }) {
  if (p.archived) return <Badge>Đã ngừng</Badge>;
  if (!p.isActive) return <Badge tone="amber">Đang ẩn</Badge>;
  return <Badge tone="green">Đang bán</Badge>;
}

function Channels({ p }: { p: AdminProductRow }) {
  if (p.archived || !p.isActive) return null;
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <Globe
        className={p.onWebsite ? 'size-4' : 'size-4 opacity-25'}
        aria-label={p.onWebsite ? 'Hiện trên website' : 'Không hiện trên website'}
      />
      <Store className={p.onPos ? 'size-4' : 'size-4 opacity-25'} aria-label={p.onPos ? 'Bán tại quầy' : 'Không bán tại quầy'} />
    </span>
  );
}

function StockText({ p }: { p: AdminProductRow }) {
  if (p.isBundle) return <span className="text-muted">Theo thành phần</span>;
  if (!p.tracked) return <span className="text-muted">Chưa bày bán</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular">
        {p.onHand.toLocaleString('vi-VN')}
        {p.unitLabel ? ` ${p.unitLabel}` : ''}
      </span>
      {p.lowStock && <Badge tone="amber">Sắp hết</Badge>}
    </span>
  );
}

/** Danh sách sản phẩm: thẻ gọn trên điện thoại, bảng nhiều cột từ máy tính bảng trở lên. */
export function ProductTable({ products }: { products: AdminProductRow[] }) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-paper">
      <div className={`hidden border-b border-line bg-hall/60 px-4 py-2.5 text-sm text-muted lg:px-5 ${GRID}`} aria-hidden>
        <span>Sản phẩm</span>
        <span>Nhóm</span>
        <span>Tồn kho</span>
        <span className="text-right">Giá</span>
        <span>Trạng thái</span>
      </div>
      <ul className="divide-y divide-line">
        {products.map((p) => {
          const meta = [p.brandName, p.variantCount > 1 ? `${p.variantCount} biến thể` : p.sku].filter(Boolean).join(', ');
          return (
            <li key={p.id}>
              <Link href={`/admin/catalog/${p.id}`} className={`flex items-start gap-3 px-4 py-3 hover:bg-hall/60 lg:px-5 ${GRID}`}>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <MediaImage path={p.cover} alt="" className="size-14 shrink-0 rounded-control xl:size-12" sizes="56px" />
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-2 font-medium break-words">{p.name}</span>
                    <span className="truncate text-sm text-muted">{meta || 'Chưa có SKU'}</span>
                    {/* Điện thoại, máy tính bảng: gom nhóm, tồn kho vào dòng phụ */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm xl:hidden">
                      <StockText p={p} />
                      {p.category && <span className="text-muted">{p.category}</span>}
                    </span>
                  </span>
                </span>
                <span className="hidden truncate text-sm xl:block">{p.category ?? <span className="text-muted">—</span>}</span>
                <span className="hidden text-sm xl:block">
                  <StockText p={p} />
                </span>
                <span className="flex max-w-[45%] shrink-0 flex-col items-end gap-1.5 text-right xl:max-w-none">
                  <span className="font-display text-base tabular xl:text-lg">{priceText(p)}</span>
                  <span className="xl:hidden">
                    <StatusBadge p={p} />
                  </span>
                </span>
                <span className="hidden items-center gap-2 xl:flex">
                  <StatusBadge p={p} />
                  <Channels p={p} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
