// RALLY_PRODUCT_SHOWCASE_V6: data-driven product catalog
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Footprints,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { formatVnd } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/env';
import { CATALOG_PAGE_SIZE, listBranchOptions, listCatalog, listCategories, type CatalogItem } from '../queries';
import { ProductPlaceholder } from './product-placeholder';

export interface ProductSearchParams {
  q?: string;
  category?: string;
  branch?: string;
  page?: string;
}

type FilterState = { q?: string; category?: string; branch?: string };

function clean(value: string | undefined, max: number) {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, max) || undefined;
}

function buildHref(filters: FilterState, patch: Partial<FilterState> & { page?: number } = {}) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...patch };
  for (const key of ['q', 'category', 'branch'] as const) {
    if (merged[key]) params.set(key, merged[key]);
  }
  if (patch.page && patch.page > 1) params.set('page', String(patch.page));
  const query = params.toString();
  return query ? `/products?${query}` : '/products';
}

function categoryIcon(label: string) {
  const v = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (v.includes('giay')) return Footprints;
  if (v.includes('quan') || v.includes('ao')) return Shirt;
  if (v.includes('nuoc') || v.includes('uong')) return ShoppingBag;
  if (v.includes('phu')) return Package;
  if (v.includes('vot')) return Tag;
  return ShieldCheck;
}

function ProductCard({ item }: { item: CatalogItem }) {
  const discounted = item.compareAtPrice !== null && item.compareAtPrice > item.minPrice;
  const discount = discounted && item.compareAtPrice !== null
    ? Math.max(0, Math.min(99, Math.round((1 - item.minPrice / item.compareAtPrice) * 100)))
    : 0;
  const available = item.available > 0;
  const lowStock = item.available > 0 && item.available <= 3;
  const priceLabel = `${item.minPrice !== item.maxPrice ? 'Từ ' : ''}${formatVnd(item.minPrice)}`;

  return (
    <li className="rally-shop-product">
      <Link href={`/products/${item.id}`} className="rally-shop-product-link" aria-label={`Xem chi tiết ${item.name}`}>
        <div className="rally-shop-product-image">
          {item.coverPath ? (
            <MediaImage path={item.coverPath} alt={item.name} className="rally-shop-media" sizes="(min-width: 1100px) 260px, (min-width: 700px) 33vw, 50vw" />
          ) : (
            <ProductPlaceholder name={item.name} category={item.categoryName} kind={item.kind} className="rally-shop-media" />
          )}
          {discounted && discount > 0 && <span className="rally-shop-sale">-{discount}%</span>}
          {item.isBundle && <span className="rally-shop-bundle">Combo</span>}
        </div>
        <div className="rally-shop-product-details">
          <span className="rally-shop-category">{item.categoryName ?? item.brandName ?? 'Vật phẩm'}</span>
          <h3 className="rally-shop-product-name">{item.name}</h3>
          <div className="rally-shop-product-bottom">
            <div className="rally-shop-price-block">
              <div className="rally-shop-prices">
                <span className={discounted ? 'rally-shop-price is-sale' : 'rally-shop-price'}>{priceLabel}</span>
                {discounted && item.compareAtPrice !== null && <s>{formatVnd(item.compareAtPrice)}</s>}
              </div>
              <span className={available ? 'rally-shop-stock is-available' : 'rally-shop-stock is-out'}>
                <span className="rally-shop-stock-dot" />
                {available ? (lowStock ? `Chỉ còn ${item.available}` : 'Còn hàng') : 'Tạm hết hàng'}
              </span>
            </div>
            <span className="rally-shop-product-open" aria-hidden="true"><ArrowUpRight size={20} /></span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function FilterPanel({ categories, branches, filters }: {
  categories: ReadonlyArray<{ slug: string; name: string }>;
  branches: ReadonlyArray<{ id: string; name: string }>;
  filters: FilterState;
}) {
  return (
    <div className="rally-shop-filters" id="bo-loc-san-pham">
      <form className="rally-shop-searchform" action="/products" method="get">
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        <div className="rally-shop-input-wrap">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="rally-shop-search">Tên sản phẩm hoặc thương hiệu</label>
          <input id="rally-shop-search" name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Tìm vợt, cầu, giày, đồ uống..." autoComplete="off" />
        </div>
        <div className="rally-shop-select-wrap">
          <MapPin size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="rally-shop-branch">Chi nhánh</label>
          <select id="rally-shop-branch" name="branch" defaultValue={filters.branch ?? ''}>
            <option value="">Mọi chi nhánh</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        <button className="rally-shop-filter-submit" type="submit"><SlidersHorizontal size={17} /> Lọc sản phẩm</button>
      </form>
      <nav className="rally-shop-chip-strip" aria-label="Lọc nhóm sản phẩm">
        <Link href={buildHref(filters, { category: undefined })} className={`rally-shop-chip ${!filters.category ? 'is-current' : ''}`} aria-current={!filters.category ? 'page' : undefined}>Tất cả</Link>
        {categories.map((category) => {
          const Icon = categoryIcon(category.name);
          return <Link key={category.slug} href={buildHref(filters, { category: category.slug })} className={`rally-shop-chip ${filters.category === category.slug ? 'is-current' : ''}`} aria-current={filters.category === category.slug ? 'page' : undefined}><Icon size={15} /> {category.name}</Link>;
        })}
      </nav>
    </div>
  );
}

export async function RallyProductShowcase({ searchParams }: { searchParams: ProductSearchParams }) {
  const q = clean(searchParams.q, 60);
  const category = clean(searchParams.category, 60);
  const branch = clean(searchParams.branch, 36);
  const rawPage = Number.parseInt(searchParams.page ?? '1', 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.min(200, rawPage)) : 1;
  const filters: FilterState = { q, category, branch };
  const configured = isSupabaseConfigured();
  const [result, categories, branches] = configured
    ? await Promise.all([
        listCatalog({ kind: 'sale', q, category, branchId: branch && /^[0-9a-f-]{36}$/i.test(branch) ? branch : undefined, page }),
        listCategories(),
        listBranchOptions(),
      ])
    : [null, [], []] as const;
  const totalPages = result ? Math.ceil(result.total / CATALOG_PAGE_SIZE) : 0;

  return (
    <div className="rally-shop">
      <section className="rally-shop-hero full-bleed" aria-labelledby="rally-shop-title">
        <div className="rally-shop-hero-photo" aria-hidden="true">
          <Image src="/images/shop-banner.webp" alt="" fill priority sizes="100vw" className="rally-shop-hero-image" />
        </div>
        <div className="rally-shop-hero-content">
          <div className="rally-shop-hero-inner">
            <p className="rally-shop-eyebrow">RALLY BADMINTON <span>/</span> VẬT PHẨM</p>
            <h1 id="rally-shop-title">Trang bị chuẩn.<br className="rally-shop-hero-break" /> Chơi bứt phá.</h1>
            <p className="rally-shop-hero-copy">Từ cầu lông, vợt, giày đến nước uống và phụ kiện. Chọn đúng món đồ cho buổi chơi, xem giá và kiểm tra hàng tại chi nhánh Rally.</p>
            <div className="rally-shop-hero-benefits" aria-label="Thông tin mua sắm">
              <span><BadgeCheck size={19} /> Giá bán minh bạch</span>
              <span><MapPin size={19} /> Theo từng chi nhánh</span>
              <span><ShoppingBag size={19} /> Nhận hàng tại quầy</span>
            </div>
          </div>
        </div>
        <span className="rally-shop-hero-corner" aria-hidden="true">RALLY / READY TO PLAY</span>
      </section>

      <div className="rally-shop-main">
        <FilterPanel categories={categories} branches={branches} filters={filters} />
        <div className="rally-shop-section-heading">
          <div>
            <p className="rally-shop-kicker">TỦ ĐỒ CỦA NGƯỜI CHƠI CẦU</p>
            <h2>{category || q ? 'Sản phẩm phù hợp với bạn' : 'Chọn đồ cho trận đấu tới'}</h2>
            <p>Khám phá sản phẩm đang được giới thiệu tại Rally. Mua và nhận trực tiếp tại quầy.</p>
          </div>
          {result && <p className="rally-shop-result-count">{result.total} sản phẩm</p>}
        </div>

        {!configured ? (
          <div className="rally-shop-state" role="status"><CircleHelp size={24} /><h3>Danh mục chưa được kết nối</h3><p>Hãy cấu hình kết nối Supabase để hiển thị sản phẩm đang bán.</p></div>
        ) : !result ? (
          <div className="rally-shop-state" role="status"><CircleHelp size={24} /><h3>Chưa thể tải danh mục</h3><p>Vui lòng thử tải lại trang sau ít phút.</p></div>
        ) : result.items.length === 0 ? (
          <div className="rally-shop-state"><Search size={26} /><h3>Chưa tìm thấy sản phẩm phù hợp</h3><p>Thử từ khóa khác hoặc bỏ bớt bộ lọc để xem thêm sản phẩm.</p><Link href="/products" className="rally-shop-reset">Xóa bộ lọc <ArrowRight size={16} /></Link></div>
        ) : (
          <>
            <ul className="rally-shop-grid">{result.items.map((item) => <ProductCard key={item.id} item={item} />)}</ul>
            {totalPages > 1 && (
              <nav className="rally-shop-pagination" aria-label="Phân trang danh sách sản phẩm">
                {page > 1 ? <Link href={buildHref(filters, { page: page - 1 })}>← Trang trước</Link> : <span />}
                <span>Trang {page} / {totalPages}</span>
                {page < totalPages ? <Link href={buildHref(filters, { page: page + 1 })}>Trang sau →</Link> : <span />}
              </nav>
            )}
          </>
        )}

        <section className="rally-shop-promos" aria-label="Khám phá thêm tại Rally">
          <Link href="/rentals" className="rally-shop-promo is-green">
            <div className="rally-shop-promo-text"><span>THUÊ DỤNG CỤ TẠI RALLY</span><h2>Quên vợt, giày?<br />Có Rally lo.</h2><span className="rally-shop-promo-link">Xem dịch vụ cho thuê <ArrowUpRight size={19} /></span></div>
            <Image src="/images/counter-rentals.webp" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="rally-shop-promo-image" />
          </Link>
          <Link href="/booking" className="rally-shop-promo is-red">
            <div className="rally-shop-promo-text"><span>ĐẶT SÂN CẦU LÔNG</span><h2>Có đồ rồi.<br />Ra sân thôi!</h2><span className="rally-shop-promo-link">Xem lịch sân trống <ArrowUpRight size={19} /></span></div>
            <Image src="/images/hero-court.webp" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="rally-shop-promo-image" />
          </Link>
        </section>
        <div className="rally-shop-disclaimer"><Clock3 size={17} /><p>Giá và số lượng còn hàng có thể khác nhau theo chi nhánh. Thanh toán và nhận hàng trực tiếp tại quầy Rally.</p></div>
      </div>
    </div>
  );
}
