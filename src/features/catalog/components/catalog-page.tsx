import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { EmptyState } from '@/components/ui/primitives';
import { isSupabaseConfigured } from '@/lib/env';
import { type Enums } from '@/lib/supabase/database.types';

import { CATALOG_PAGE_SIZE, listBranchOptions, listCatalog, listCategories } from '../queries';

import { CatalogFilters, Pagination } from './catalog-filters';
import { CatalogGrid } from './catalog-grid';
import { CatalogHero, type CatalogHighlight } from './catalog-hero';

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  branch?: string;
  page?: string;
}

interface CatalogPageProps {
  kind: Enums<'product_kind'>;
  title: string;
  /** Phần tiêu đề tô xanh (đứng sau title). */
  accent?: string;
  description: string;
  highlights: CatalogHighlight[];
  searchParams: CatalogSearchParams;
}

function clean(value: string | undefined, max: number): string | undefined {
  const v = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return v.length > 0 ? v : undefined;
}

export async function CatalogPage({ kind, title, accent, description, highlights, searchParams }: CatalogPageProps) {
  const basePath = kind === 'sale' ? '/products' : '/rentals';
  if (!isSupabaseConfigured()) {
    return (
      <>
        <CatalogHero title={title} accent={accent} description={description} highlights={highlights} />
        <div className="py-8">
          <SetupNotice />
        </div>
      </>
    );
  }
  const q = clean(searchParams.q, 60);
  const category = clean(searchParams.category, 60);
  const branch = clean(searchParams.branch, 36);
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.page ?? '1', 10) || 1));
  const [result, categories, branches] = await Promise.all([
    listCatalog({ kind, q, category, branchId: branch && /^[0-9a-f-]{36}$/i.test(branch) ? branch : undefined, page }),
    listCategories(),
    listBranchOptions(),
  ]);

  return (
    <>
      <CatalogHero title={title} accent={accent} description={description} highlights={highlights} />
      <div className="pt-6 sm:pt-8">
        <CatalogFilters basePath={basePath} categories={categories} branches={branches} current={{ q, category, branch }} />
        {!result && <LoadErrorNotice />}
        {result && result.items.length === 0 && (
          <EmptyState title={q || category || branch ? 'Không có kết quả phù hợp' : 'Danh mục đang được cập nhật'}>
            {q || category || branch ? 'Thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa khác.' : 'Vui lòng hỏi nhân viên tại quầy.'}
          </EmptyState>
        )}
        {result && result.items.length > 0 && (
          <>
            <CatalogGrid items={result.items} basePath={basePath} />
            <Pagination
              basePath={basePath}
              page={page}
              totalPages={Math.ceil(result.total / CATALOG_PAGE_SIZE)}
              params={{ q, category, branch }}
            />
          </>
        )}
        <p className="mt-10 text-sm text-muted">
          {kind === 'sale'
            ? 'Thanh toán và nhận hàng tại quầy chi nhánh. Tồn kho cập nhật theo từng giao dịch.'
            : 'Thuê và trả tại quầy chi nhánh. Giá khác nhau khi dùng tại sân, theo trận hoặc mang ra ngoài.'}
        </p>
      </div>
    </>
  );
}
