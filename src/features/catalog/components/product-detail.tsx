import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { formatRateLabel, formatVariantLabel, formatVnd } from '@/lib/format';
import { RENTAL_RATE_KINDS } from '@/lib/labels';

import { type ProductDetail } from '../queries';

import { ProductPlaceholder } from './product-placeholder';

export function ProductDetailView({ product, backHref, backLabel }: { product: ProductDetail; backHref: string; backLabel: string }) {
  const photos = [...product.product_photos].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const variants = [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const rates = product.rental_rates.filter((r) => r.is_active).sort((a, b) => a.duration_minutes - b.duration_minutes);
  const hasOptions = variants.some((v) => v.size_label || v.color_label);
  const names = { option1: product.option1_name, option2: product.option2_name };
  const variantLabel = (v: { size_label: string | null; color_label: string | null }) =>
    formatVariantLabel(v.size_label, v.color_label, names) ?? 'Tiêu chuẩn';
  const units = product.product_units.filter((u) => u.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order);

  /** Tồn theo chi nhánh: gộp các biến thể. */
  const byBranch = new Map<string, { name: string; qty: number }>();
  for (const v of variants) {
    for (const lvl of v.inventory_levels) {
      if (!lvl.is_listed || !lvl.branches) continue;
      const cur = byBranch.get(lvl.branches.id) ?? { name: lvl.branches.name, qty: 0 };
      cur.qty += lvl.on_hand;
      byBranch.set(lvl.branches.id, cur);
    }
  }

  return (
    <div className="py-6 sm:py-8">
      <Link href={backHref} className="text-sm text-muted underline-offset-4 hover:underline">
        {backLabel}
      </Link>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-14">
        <div className="flex flex-col gap-3 md:sticky md:top-20 md:self-start">
          {photos[0] ? (
            <MediaImage
              path={photos[0].storage_path}
              alt={photos[0].alt_text ?? product.name}
              className="aspect-[4/3] rounded-panel md:aspect-square"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          ) : (
            <ProductPlaceholder
              name={product.name}
              category={product.product_categories?.name ?? null}
              kind={product.kind}
              className="aspect-[4/3] rounded-panel md:aspect-square"
            />
          )}
          {photos.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {photos.slice(1, 5).map((p) => (
                <li key={p.storage_path}>
                  <MediaImage
                    path={p.storage_path}
                    alt={p.alt_text ?? product.name}
                    className="aspect-square rounded-control"
                    sizes="120px"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <div>
            {product.product_categories && <p className="text-sm text-muted">{product.product_categories.name}</p>}
            <h1 className="mt-1 text-3xl break-words sm:text-4xl">{product.name}</h1>
            {product.brand_name && <p className="mt-1 text-muted">{product.brand_name}</p>}
            {product.excerpt && <p className="mt-3 text-lg leading-relaxed">{product.excerpt}</p>}
          </div>

          {product.kind === 'sale' && product.base_price !== null && (
            <p className="font-display text-4xl tabular">
              {formatVnd(product.base_price)}
              {product.unit_label && <span className="font-sans text-lg text-muted"> / {product.unit_label}</span>}
              {product.compare_at_price && <s className="ml-3 font-sans text-lg text-muted">{formatVnd(product.compare_at_price)}</s>}
            </p>
          )}

          {product.kind === 'sale' && product.base_price !== null && units.length > 0 && (
            <ul className="-mt-3 flex flex-wrap gap-2 text-sm">
              {units.map((u) => (
                <li key={u.id} className="rounded-full border border-line px-3 py-1">
                  {u.name} {u.conversion} {product.unit_label ?? 'đơn vị'}:{' '}
                  <span className="font-medium tabular">{formatVnd(u.price ?? (product.base_price ?? 0) * u.conversion)}</span>
                </li>
              ))}
            </ul>
          )}

          {rates.length > 0 && (
            <div>
              <h2 className="mb-2 text-xl">Giá thuê</h2>
              <ul className="divide-y divide-line border-y border-line">
                {RENTAL_RATE_KINDS.flatMap((k) =>
                  rates
                    .filter((r) => r.usage === k.usage && r.billing === k.billing)
                    .map((r) => (
                      <li key={r.id} className="flex items-baseline justify-between gap-3 py-3">
                        <span className="flex min-w-0 flex-col">
                          <span>{r.billing === 'session' ? r.label : formatRateLabel(r.label, r.duration_minutes)}</span>
                          <span className="text-sm text-muted">{k.label}</span>
                        </span>
                        <span className="font-display text-xl tabular">{formatVnd(r.price)}</span>
                      </li>
                    )),
                )}
              </ul>
              <p className="mt-2 text-sm text-muted">Giá mỗi món. Trả trễ quá thời gian ân hạn sẽ tính phụ phí theo giờ tại quầy.</p>
            </div>
          )}

          {product.description && <p className="leading-relaxed whitespace-pre-line">{product.description}</p>}

          {product.is_bundle && product.bundle_components.length > 0 && (
            <div>
              <h2 className="mb-2 text-xl">Combo gồm</h2>
              <ul className="flex flex-col gap-1">
                {product.bundle_components.map((c) => (
                  <li key={c.product_variants?.id}>
                    {c.quantity} × {c.product_variants?.products?.name}
                    {c.product_variants && (c.product_variants.size_label || c.product_variants.color_label)
                      ? ` (${formatVariantLabel(c.product_variants.size_label, c.product_variants.color_label) ?? ''})`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasOptions && product.kind === 'sale' && (
            <div>
              <h2 className="mb-2 text-xl">Lựa chọn</h2>
              <ul className="divide-y divide-line border-y border-line text-[0.95rem]">
                {variants.map((v) => {
                  const qty = v.inventory_levels.filter((l) => l.is_listed).reduce((s, l) => s + l.on_hand, 0);
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span>{variantLabel(v)}</span>
                      <span className="text-sm text-muted tabular">
                        {formatVnd(v.price_override ?? product.base_price)}, {qty > 0 ? `còn ${qty}` : 'hết hàng'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {byBranch.size > 0 && !product.is_bundle && (
            <div>
              <h2 className="mb-2 text-xl">Có tại chi nhánh</h2>
              <ul className="flex flex-col gap-1 text-[0.95rem]">
                {[...byBranch.entries()].map(([id, b]) => (
                  <li key={id} className="flex justify-between gap-3">
                    <span>{b.name}</span>
                    <span className={b.qty > 0 ? 'text-court-deep' : 'text-muted'}>
                      {b.qty > 0 ? `${b.qty} ${product.kind === 'rental' ? 'sẵn sàng' : 'còn'}` : 'Tạm hết'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rounded-control bg-hall p-4 text-sm">
            {product.kind === 'rental'
              ? 'Thuê và trả tại quầy chi nhánh. Nhân viên sẽ ghi nhận giờ nhận và giờ trả.'
              : 'Thanh toán và nhận hàng tại quầy chi nhánh.'}
          </p>
        </div>
      </div>
    </div>
  );
}
