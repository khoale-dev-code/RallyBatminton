import Form from 'next/form';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';

import { buttonClass, LinkButton } from '@/components/ui/button';
import { LinkTabs } from '@/components/ui/link-tabs';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { ProductTable } from '@/features/admin-catalog/components/list/product-table';
import { listCategoriesAdmin, listProductsAdmin, type ProductKind, type ProductStatusFilter } from '@/features/admin-catalog/queries';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';

export const metadata = { title: 'Quản lý sản phẩm' };

interface Search {
  kind?: string;
  q?: string;
  status?: string;
  category?: string;
}

const STATUS: Array<{ value: ProductStatusFilter; label: string }> = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'hidden', label: 'Đang ẩn' },
  { value: 'archived', label: 'Đã ngừng' },
];

const selectClass = 'min-h-11 w-full min-w-0 rounded-control border border-line bg-paper px-2 text-[0.95rem]';

export default async function ProductManagerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const kind: ProductKind = sp.kind === 'rental' ? 'rental' : 'sale';
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 60) : undefined;
  const status = STATUS.find((s) => s.value === sp.status)?.value ?? 'all';
  const categoryId = typeof sp.category === 'string' ? sp.category : undefined;
  const [{ ctx }, [products, categories]] = await withGuard(requireBranchPermission('catalog.view'), () =>
    Promise.all([listProductsAdmin({ kind, q, status, categoryId }), listCategoriesAdmin()]),
  );
  const canEdit = hasPermission(ctx, 'catalog.edit');
  const filtered = Boolean(q || status !== 'all' || categoryId);
  const tabHref = (k: ProductKind) => `/admin/catalog?kind=${k}`;

  return (
    <>
      <PageHeader
        title="Quản lý sản phẩm"
        description="Sản phẩm dùng chung cho mọi chi nhánh. Tồn kho và việc bày bán quản lý riêng từng chi nhánh."
        actions={
          <>
            {isOwner(ctx) && (
              <LinkButton href="/admin/catalog/categories" variant="ghost">
                Nhóm sản phẩm
              </LinkButton>
            )}
            {canEdit && (
              <LinkButton href={`/admin/catalog/new?kind=${kind}`} variant="primary">
                <Plus className="size-4" aria-hidden />
                Thêm sản phẩm
              </LinkButton>
            )}
          </>
        }
      />
      <LinkTabs
        label="Loại sản phẩm"
        tabs={[
          { href: tabHref('sale'), label: 'Hàng bán', active: kind === 'sale' },
          { href: tabHref('rental'), label: 'Đồ cho thuê', active: kind === 'rental' },
        ]}
      />
      <Form data-nav-progress action="/admin/catalog" className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_11rem_10rem_auto]">
        <input type="hidden" name="kind" value={kind} />
        <div className="relative col-span-2 md:col-span-1">
          <label htmlFor="q" className="sr-only">
            Tìm sản phẩm
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Tên, thương hiệu, SKU, mã vạch"
            className="min-h-11 w-full min-w-0 rounded-control border border-line bg-paper pr-3 pl-9"
          />
        </div>
        <label htmlFor="category" className="sr-only">
          Nhóm sản phẩm
        </label>
        <select id="category" name="category" defaultValue={categoryId ?? ''} className={selectClass}>
          <option value="">Mọi nhóm</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="status" className="sr-only">
          Trạng thái
        </label>
        <select id="status" name="status" defaultValue={status} className={selectClass}>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass('outline', 'md', 'col-span-2 md:col-span-1')}>
          Lọc
        </button>
      </Form>
      <p className="mb-3 flex flex-wrap items-center gap-x-3 text-sm text-muted">
        <span>
          {products.length >= 200 ? 'Hiện 200 sản phẩm đầu tiên' : `${products.length} sản phẩm`}
          {filtered ? ' phù hợp' : ''}
        </span>
        {filtered && (
          <Link href={tabHref(kind)} className="inline-flex min-h-9 items-center text-ink underline underline-offset-4">
            Xóa bộ lọc
          </Link>
        )}
      </p>

      {products.length === 0 ? (
        filtered ? (
          <EmptyState title="Không có sản phẩm phù hợp">Thử từ khóa khác hoặc xóa bộ lọc.</EmptyState>
        ) : (
          <EmptyState
            title={kind === 'sale' ? 'Chưa có hàng bán' : 'Chưa có đồ cho thuê'}
            action={canEdit ? <LinkButton href={`/admin/catalog/new?kind=${kind}`}>Thêm sản phẩm đầu tiên</LinkButton> : undefined}
          />
        )
      ) : (
        <ProductTable products={products} />
      )}
    </>
  );
}
