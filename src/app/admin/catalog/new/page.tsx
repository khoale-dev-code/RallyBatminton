import Link from 'next/link';

import { PageHeader } from '@/components/ui/primitives';
import { ProductEditor } from '@/features/admin-catalog/components/editor/product-editor';
import { newProductDraft } from '@/features/admin-catalog/lib/initial-draft';
import { listCategoriesAdmin, listTagSuggestions } from '@/features/admin-catalog/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { branchesWith, isOwner } from '@/lib/auth/permissions';
import { publicEnv } from '@/lib/env';
import { getBrandTax } from '@/features/brand/queries';

export const metadata = { title: 'Thêm sản phẩm' };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ kind?: string; bundle?: string }> }) {
  const { ctx } = await requireBranchPermission('catalog.edit');
  const sp = await searchParams;
  const kind = sp.kind === 'rental' ? 'rental' : 'sale';
  const [categories, tagSuggestions, brandTax] = await Promise.all([listCategoriesAdmin(), listTagSuggestions(), getBrandTax()]);
  // Chỉ bày bán được ở chi nhánh có quyền sửa danh mục; tồn đầu kỳ cần thêm quyền điều chỉnh kho (database cũng kiểm tra).
  const branches = branchesWith(ctx, 'catalog.edit').map((b) => ({
    id: b.branchId,
    name: b.name,
    canStock: b.permissions.includes('inventory.adjust'),
  }));
  const initial = newProductDraft(
    kind,
    sp.bundle === '1',
    branches.map((b) => b.id),
  );

  return (
    <>
      <PageHeader
        title="Thêm sản phẩm"
        back={
          <Link href={`/admin/catalog?kind=${kind}`} className="text-sm text-muted hover:underline">
            Quản lý sản phẩm
          </Link>
        }
      />
      <ProductEditor
        mode="create"
        initial={initial}
        categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }))}
        branches={branches}
        tagSuggestions={tagSuggestions}
        canManageCategories={isOwner(ctx)}
        siteHost={new URL(publicEnv.siteUrl).host}
        brandTax={brandTax}
        canManageTax={isOwner(ctx)}
      />
    </>
  );
}
