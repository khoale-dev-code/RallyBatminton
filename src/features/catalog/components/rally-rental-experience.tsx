// RALLY_RENTAL_EXPERIENCE_V7
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Clock3, MapPin, PackageCheck, Search, SlidersHorizontal } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { Pagination } from '@/features/catalog/components/catalog-filters';
import { ProductPlaceholder } from '@/features/catalog/components/product-placeholder';
import { CATALOG_PAGE_SIZE, listBranchOptions, listCatalog, listCategories, type CatalogItem } from '@/features/catalog/queries';
import { isSupabaseConfigured } from '@/lib/env';
import { formatVnd } from '@/lib/format';

export interface RentalSearchParams {
  q?: string;
  category?: string;
  branch?: string;
  page?: string;
}

type RentalFilters = Pick<RentalSearchParams, 'q' | 'category' | 'branch'>;
type CategoryOption = { slug: string; name: string };
type BranchOption = { id: string; name: string };

function clean(value: string | undefined, max: number): string | undefined {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return text || undefined;
}

function RentalFilterPanel({
  filters,
  branches,
  categories,
}: {
  filters: RentalFilters;
  branches: ReadonlyArray<BranchOption>;
  categories: ReadonlyArray<CategoryOption>;
}) {
  const active = Boolean(filters.q || filters.branch || filters.category);
  return (
    <aside className="rally-rental-filter" aria-label="Bộ lọc dụng cụ cho thuê">
      <div className="rally-rental-filter-heading">
        <span className="rally-rental-filter-symbol"><SlidersHorizontal aria-hidden size={18} /></span>
        <div>
          <h3>Tìm dụng cụ</h3>
          <p>Chọn nhanh theo nhu cầu của bạn</p>
        </div>
      </div>
      <form action="/rentals" method="get" className="rally-rental-filter-form" data-nav-progress>
        <label htmlFor="rental-search">Tên dụng cụ</label>
        <div className="rally-rental-input-wrap">
          <Search aria-hidden size={17} />
          <input id="rental-search" name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Vợt, giày, combo..." />
        </div>
        <label htmlFor="rental-branch">Chi nhánh</label>
        <div className="rally-rental-select-wrap">
          <MapPin aria-hidden size={17} />
          <select id="rental-branch" name="branch" defaultValue={filters.branch ?? ''}>
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <ChevronDown aria-hidden size={15} />
        </div>
        <label htmlFor="rental-category">Loại dụng cụ</label>
        <div className="rally-rental-select-wrap">
          <PackageCheck aria-hidden size={17} />
          <select id="rental-category" name="category" defaultValue={filters.category ?? ''}>
            <option value="">Tất cả loại</option>
            {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <ChevronDown aria-hidden size={15} />
        </div>
        <button className="rally-rental-filter-submit" type="submit">Xem dụng cụ <ArrowRight aria-hidden size={17} /></button>
      </form>
      {active && <Link href="/rentals" className="rally-rental-reset">Xóa bộ lọc <ArrowRight aria-hidden size={15} /></Link>}
      <div className="rally-rental-filter-note">
        <Clock3 aria-hidden size={19} />
        <p>Giá tùy hình thức thuê và thời lượng. Xem chi tiết từng sản phẩm để chọn gói phù hợp.</p>
      </div>
    </aside>
  );
}

function RentalCard({ item }: { item: CatalogItem }) {
  const available = item.available > 0;
  return (
    <li>
      <Link href={`/rentals/${item.id}`} className="rally-rental-item">
        <div className="rally-rental-item-media">
          {item.coverPath ? (
            <MediaImage path={item.coverPath} alt={item.name} className="rally-rental-item-image" sizes="(min-width: 1200px) 240px, (min-width: 768px) 33vw, 100vw" />
          ) : (
            <ProductPlaceholder name={item.name} category={item.categoryName} kind="rental" className="rally-rental-item-image" />
          )}
          {item.isBundle && <span className="rally-rental-combo">COMBO</span>}
        </div>
        <div className="rally-rental-item-content">
          <span className="rally-rental-item-category">{item.categoryName ?? 'Dụng cụ cho thuê'}</span>
          <h3>{item.name}</h3>
          {item.brandName && <p className="rally-rental-brand">Thương hiệu: {item.brandName}</p>}
          <div className="rally-rental-item-price">
            <span>Giá thuê từ</span>
            <strong>{formatVnd(item.minPrice)}</strong>
          </div>
          <div className="rally-rental-item-bottom">
            <span className={available ? 'rally-rental-available' : 'rally-rental-unavailable'}>
              <span aria-hidden className="rally-rental-stock-dot" />
              {available ? 'Đang có dụng cụ' : 'Hiện không có sẵn'}
            </span>
            <span className="rally-rental-open" aria-label={`Xem chi tiết ${item.name}`}><ArrowUpRight aria-hidden size={20} /></span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function RentalSteps() {
  return (
    <section aria-labelledby="rental-steps-title" className="rally-rental-steps">
      <div className="rally-rental-steps-heading">
        <div><span className="rally-rental-eyebrow">THUÊ ĐỒ ĐƠN GIẢN</span><h2 id="rental-steps-title">Đến sân, nhận đồ, vào trận.</h2></div>
        <p>Không cần chuẩn bị quá nhiều. Chọn dụng cụ phù hợp và hoàn tất thủ tục tại quầy chi nhánh.</p>
      </div>
      <ol className="rally-rental-steps-grid">
        <li><b>01</b><span><strong>Tìm dụng cụ</strong><small>Khám phá vợt, giày hoặc combo đang có tại Rally.</small></span><Search aria-hidden size={22} /></li>
        <li><b>02</b><span><strong>Chọn gói thuê</strong><small>Xem các hình thức, mức giá và thời lượng trong chi tiết sản phẩm.</small></span><Clock3 aria-hidden size={22} /></li>
        <li><b>03</b><span><strong>Nhận tại quầy</strong><small>Liên hệ nhân viên tại chi nhánh để kiểm tra và nhận dụng cụ.</small></span><Check aria-hidden size={22} /></li>
      </ol>
    </section>
  );
}

export async function RallyRentalExperience({ searchParams }: { searchParams: RentalSearchParams }) {
  const filters: RentalFilters = {
    q: clean(searchParams.q, 60),
    category: clean(searchParams.category, 60),
    branch: clean(searchParams.branch, 36),
  };
  const rawPage = Number.parseInt(searchParams.page ?? '1', 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.min(200, rawPage)) : 1;
  const configured = isSupabaseConfigured();
  const [result, categories, branches] = configured
    ? await Promise.all([
        listCatalog({
          kind: 'rental',
          page,
          q: filters.q,
          category: filters.category,
          branchId: filters.branch && /^[0-9a-f-]{36}$/i.test(filters.branch) ? filters.branch : undefined,
        }),
        listCategories(),
        listBranchOptions(),
      ])
    : [null, [] as ReadonlyArray<CategoryOption>, [] as ReadonlyArray<BranchOption>] as const;

  return (
    <div className="rally-rental-page">
      <section className="rally-rental-hero full-bleed" aria-labelledby="rally-rental-heading">
        <div className="rally-rental-hero-inner">
          <div className="rally-rental-hero-copy">
            <div className="rally-rental-kicker"><span aria-hidden /> RALLY / CHO THUÊ DỤNG CỤ</div>
            <h1 id="rally-rental-heading"><span>Quên đồ?</span>{' '}<span>Cứ ra sân.</span></h1>
            <p>Thiếu vợt hoặc giày? Xem gói thuê, chọn dụng cụ phù hợp và nhận tại quầy Rally.</p>
            <div className="rally-rental-hero-actions">
              <a href="#danh-sach-do-thue" className="rally-rental-primary">Khám phá đồ cho thuê <ArrowDown aria-hidden size={19} /></a>
              <Link href="/branches" className="rally-rental-secondary">Tìm chi nhánh <ArrowUpRight aria-hidden size={18} /></Link>
            </div>
            <ul className="rally-rental-hero-points">
              <li><Check aria-hidden size={15} /> Nhận tại quầy</li>
              <li><Check aria-hidden size={15} /> Nhiều gói thời lượng</li>
              <li><Check aria-hidden size={15} /> Xem giá trước khi đến</li>
            </ul>
          </div>
          <div className="rally-rental-hero-art" aria-hidden>
            <span className="rally-rental-art-sup">BUỔI CHƠI KHÔNG GIÁN ĐOẠN</span>
            <div className="rally-rental-art-photo"><Image src="/images/counter-rentals.webp" alt="" fill priority sizes="(min-width: 1100px) 550px, 100vw" className="rally-rental-art-image" /></div>
            <span className="rally-rental-art-caption">JUST PLAY.</span>
          </div>
        </div>
      </section>

      <div className="rally-rental-benefits" aria-label="Thông tin dịch vụ">
        <div><PackageCheck aria-hidden size={21} /><span><b>Nhận & trả tại quầy</b><small>Hỗ trợ tại chi nhánh Rally</small></span></div>
        <div><Clock3 aria-hidden size={21} /><span><b>Gói thuê linh hoạt</b><small>Theo hình thức và thời lượng</small></span></div>
        <div><MapPin aria-hidden size={21} /><span><b>Chọn đúng chi nhánh</b><small>Xem thông tin trước khi đến</small></span></div>
      </div>

      <section id="danh-sach-do-thue" aria-labelledby="rally-rental-list-heading" className="rally-rental-catalog">
        <header className="rally-rental-catalog-heading">
          <div>
            <span className="rally-rental-eyebrow">DANH MỤC CHO THUÊ</span>
            <h2 id="rally-rental-list-heading">Chọn món đồ hợp trận đấu.</h2>
          </div>
          <p>Giá và tình trạng dụng cụ được cập nhật từ hệ thống. Bấm vào từng món để xem các gói thuê.</p>
        </header>
        {!configured ? (
          <SetupNotice />
        ) : (
          <div className="rally-rental-catalog-layout">
            <RentalFilterPanel categories={categories} branches={branches} filters={filters} />
            <div className="rally-rental-catalog-results">
              <div className="rally-rental-results-top">
                <span><b>{result ? result.total.toLocaleString('vi-VN') : '—'}</b> lựa chọn</span>
                <span className="rally-rental-results-hint">Xem chi tiết để biết gói thuê và thời lượng</span>
              </div>
              {!result && <LoadErrorNotice />}
              {result && result.items.length === 0 && (
                <div className="rally-rental-no-results">
                  <CircleHelp aria-hidden size={30} />
                  <h3>Chưa tìm thấy dụng cụ phù hợp</h3>
                  <p>Thử chọn chi nhánh khác hoặc điều chỉnh từ khóa tìm kiếm.</p>
                  <Link href="/rentals">Xem tất cả đồ cho thuê <ArrowRight aria-hidden size={16} /></Link>
                </div>
              )}
              {result && result.items.length > 0 && (
                <>
                  <ul className="rally-rental-cards">{result.items.map((item) => <RentalCard key={item.id} item={item} />)}</ul>
                  <Pagination basePath="/rentals" page={page} totalPages={Math.ceil(result.total / CATALOG_PAGE_SIZE)} params={{ q: filters.q, category: filters.category, branch: filters.branch }} />
                </>
              )}
            </div>
          </div>
        )}
      </section>
      <RentalSteps />
      <section aria-label="Bắt đầu đặt sân" className="rally-rental-final">
        <div><span className="rally-rental-eyebrow">SẴN SÀNG RA SÂN?</span><h2>Có đồ rồi. Chọn sân thôi.</h2><p>Chọn giờ chơi phù hợp và gặp nhau tại Rally.</p></div>
        <Link href="/booking">Xem giờ trống <ArrowRight aria-hidden size={19} /></Link>
      </section>
      <p className="rally-rental-disclaimer">Dụng cụ được nhận và trả tại quầy. Giá và tình trạng thực tế có thể khác theo chi nhánh, hình thức và thời lượng thuê.</p>
    </div>
  );
}
