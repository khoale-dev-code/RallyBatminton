import { CheckCircle2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MediaImage } from '@/components/brand/media-image';
import { PhotoUploader } from '@/components/media/photo-uploader';
import { ActionButton } from '@/components/ui/action-button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, Disclosure, PageHeader } from '@/components/ui/primitives';
import {
  addBundleComponentAction,
  addProductPhotoAction,
  archiveProductAction,
  deleteProductPhotoAction,
  removeBundleComponentAction,
  restoreProductAction,
  setBranchListingAction,
  setProductCoverAction,
} from '@/features/admin-catalog/actions';
import { ProductEditor } from '@/features/admin-catalog/components/editor/product-editor';
import { RentalRatesPanel } from '@/features/admin-catalog/components/rental-rates-panel';
import { draftFromProduct } from '@/features/admin-catalog/lib/initial-draft';
import { variantTitle } from '@/features/admin-catalog/lib/product-draft';
import { getProductForEdit, listCategoriesAdmin, listComponentCandidates, listTagSuggestions } from '@/features/admin-catalog/queries';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';
import { getBrandTax } from '@/features/brand/queries';
import { formatVariantLabel } from '@/lib/format';

export const metadata = { title: 'Chi tiết sản phẩm' };

interface Search {
  created?: string;
  photo_errors?: string;
}

export default async function ProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const productQuery = getProductForEdit(id);
  const [{ ctx }, [data, categories, tagSuggestions, brandTax, bundleCandidates]] = await withGuard(
    requireBranchPermission('catalog.view'),
    () =>
      Promise.all([
        productQuery,
        listCategoriesAdmin(),
        listTagSuggestions(),
        getBrandTax(),
        // Món thành phần của combo: tải ngay khi biết là combo, không chờ thêm một lượt sau khi trang đã có dữ liệu.
        productQuery.then((d) => (d?.product.is_bundle ? listComponentCandidates() : [])),
      ]),
  );
  if (!data) notFound();
  const { product: p, variants, photos, rates, components, levels, branches, units } = data;
  const canEdit = hasPermission(ctx, 'catalog.edit');
  const archived = p.deleted_at !== null;
  const stockable = !p.is_bundle;
  const candidates = canEdit ? bundleCandidates : [];
  const onHand: Record<string, number> = {};
  for (const l of levels) onHand[l.variant_id] = (onHand[l.variant_id] ?? 0) + l.on_hand;
  const initial = draftFromProduct(p, variants, onHand, units);
  const photoErrors = Number(sp.photo_errors) || 0;
  const label = (v: { size_label: string | null; color_label: string | null }) =>
    variantTitle({ sizeLabel: v.size_label ?? '', colorLabel: v.color_label ?? '' });

  const mediaSlot = (
    <CollapsibleSection
      title="Hình ảnh sản phẩm"
      description="Ảnh nền sáng, sản phẩm ở giữa. Ảnh được nén WebP trước khi tải lên."
      summary={photos.length ? `${photos.length} ảnh` : 'Chưa có ảnh'}
    >
      {photos.length > 0 ? (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((ph) => (
            <li key={ph.id} className="flex min-w-0 flex-col gap-2">
              <MediaImage path={ph.storage_path} alt={ph.alt_text ?? p.name} className="aspect-square rounded-control" sizes="200px" />
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {ph.is_cover ? (
                    <Badge tone="green">Ảnh chính</Badge>
                  ) : (
                    <ActionButton action={setProductCoverAction.bind(null, ph.id)} label="Đặt làm ảnh chính" variant="ghost" />
                  )}
                  <ActionButton
                    action={deleteProductPhotoAction.bind(null, ph.id)}
                    label="Xóa"
                    variant="danger"
                    confirmMessage="Xóa ảnh này?"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-muted">Chưa có ảnh.</p>
      )}
      {canEdit && <PhotoUploader folder="products" ownerId={p.id} onUploaded={addProductPhotoAction.bind(null, p.id)} />}
    </CollapsibleSection>
  );

  const inventorySlot = stockable ? (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="font-medium">Bày bán theo chi nhánh</h3>
      <p className="text-sm text-muted">Bật hiển thị để khách thấy món này ở chi nhánh. Mức cảnh báo giúp nhắc nhập hàng.</p>
      <ul className="mt-1 flex flex-col gap-2">
        {branches.map((b) => {
          const rows = levels.filter((l) => l.branch_id === b.id);
          const listed = rows.filter((l) => l.is_listed).length;
          const total = rows.reduce((s, l) => s + l.on_hand, 0);
          const canEditBranch = canEdit && hasPermission(ctx, 'catalog.edit', b.id);
          return (
            <li key={b.id}>
              <Disclosure
                summary={
                  <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="truncate">{b.name}</span>
                    <span className="text-sm font-normal text-muted tabular">
                      {rows.length === 0 ? 'Chưa bày bán' : `Đang bán ${listed}/${variants.length}, tồn ${total.toLocaleString('vi-VN')}`}
                    </span>
                  </span>
                }
              >
                <ul className="flex flex-col gap-4">
                  {variants.map((v) => {
                    const level = rows.find((l) => l.variant_id === v.id);
                    return (
                      <li key={v.id} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                        <p className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{label(v)}</span>
                          <span className="text-sm text-muted tabular">Tồn: {level?.on_hand ?? 0}</span>
                        </p>
                        {canEditBranch ? (
                          <ActionForm action={setBranchListingAction.bind(null, p.id)} className="gap-3">
                            <input type="hidden" name="branch_id" value={b.id} />
                            <input type="hidden" name="variant_id" value={v.id} />
                            <CheckboxField name="is_listed" label="Hiển thị tại chi nhánh" defaultChecked={level?.is_listed ?? true} />
                            <TextField
                              name="reorder_level"
                              label="Cảnh báo khi tồn ≤"
                              type="number"
                              min={0}
                              defaultValue={level?.reorder_level ?? 0}
                            />
                            <SubmitButton size="sm" variant="outline">
                              Lưu
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <p className="text-sm text-muted">
                            {level ? (level.is_listed ? 'Đang hiển thị' : 'Đang ẩn') : 'Chưa bày bán tại chi nhánh'}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Disclosure>
            </li>
          );
        })}
      </ul>
    </div>
  ) : undefined;

  const mainSlot = (
    <>
      {p.kind === 'rental' && <RentalRatesPanel productId={p.id} rates={rates} canEdit={canEdit} />}
      {p.is_bundle && (
        <CollapsibleSection
          title="Thành phần combo"
          description="Khi cho thuê combo, kho trừ từng món thành phần."
          summary={`${components.length} món`}
        >
          {components.length === 0 ? (
            <p className="text-muted">Combo chưa có thành phần.</p>
          ) : (
            <ul className="divide-y divide-line">
              {components.map((c) => (
                <li key={c.component_variant_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    {c.product_variants?.products?.name}
                    {c.product_variants && formatVariantLabel(c.product_variants.size_label, c.product_variants.color_label)
                      ? `, ${formatVariantLabel(c.product_variants.size_label, c.product_variants.color_label)}`
                      : ''}
                    <span className="text-muted tabular"> × {c.quantity}</span>
                  </span>
                  {canEdit && (
                    <ActionButton
                      action={removeBundleComponentAction.bind(null, p.id, c.component_variant_id)}
                      label="Bỏ"
                      variant="ghost"
                      confirmMessage="Bỏ món này khỏi combo?"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && candidates.length > 0 && (
            <div className="mt-4">
              <ActionForm action={addBundleComponentAction.bind(null, p.id)}>
                <SelectField
                  name="component_variant_id"
                  label="Món thành phần"
                  placeholder="Chọn món"
                  options={candidates.map((c) => ({ value: c.id, label: c.label }))}
                  required
                />
                <TextField name="quantity" label="Số lượng" type="number" min={1} max={50} defaultValue={1} />
                <SubmitButton size="sm">Thêm vào combo</SubmitButton>
              </ActionForm>
            </div>
          )}
        </CollapsibleSection>
      )}
    </>
  );

  const sideSlot = canEdit ? (
    <CollapsibleSection title={archived ? 'Mở bán lại' : 'Ngừng kinh doanh'} defaultOpen={archived}>
      {archived ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Sản phẩm đang ngừng kinh doanh. Mở bán lại để hiện trên website và quầy.</p>
          <ActionButton action={restoreProductAction.bind(null, p.id)} label="Mở bán lại" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Ẩn khỏi website và quầy. Lịch sử bán, thuê và tồn kho vẫn được giữ, có thể mở bán lại.</p>
          <ActionButton
            action={archiveProductAction.bind(null, p.id)}
            label="Ngừng kinh doanh"
            variant="danger"
            confirmMessage="Ngừng kinh doanh sản phẩm này? Sản phẩm sẽ ẩn khỏi website và quầy; lịch sử bán/thuê vẫn được giữ."
          />
        </div>
      )}
    </CollapsibleSection>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {p.kind === 'sale' ? 'Hàng bán' : p.is_bundle ? 'Combo cho thuê' : 'Đồ cho thuê'}
            {archived ? (
              <Badge>Đã ngừng kinh doanh</Badge>
            ) : p.is_active ? (
              <Badge tone="green">Đang kinh doanh</Badge>
            ) : (
              <Badge tone="amber">Đang ẩn</Badge>
            )}
          </span>
        }
        back={
          <Link href={`/admin/catalog?kind=${p.kind}`} className="text-sm text-muted hover:underline">
            Quản lý sản phẩm
          </Link>
        }
      />
      {sp.created === '1' && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-control bg-court-soft px-3 py-2.5 text-sm text-court-deep">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {p.kind === 'rental'
            ? p.is_bundle
              ? 'Đã tạo combo. Thêm món thành phần ở khung Thành phần combo.'
              : 'Đã tạo đồ cho thuê. Kiểm tra gói giá thuê bên dưới.'
            : 'Đã tạo sản phẩm.'}
        </p>
      )}
      {photoErrors > 0 && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2.5 text-sm text-amber-deep">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {photoErrors} ảnh chưa tải lên được. Thử thêm lại ở khung Hình ảnh sản phẩm.
        </p>
      )}
      <ProductEditor
        mode="edit"
        productId={p.id}
        version={p.updated_at}
        initial={initial}
        categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }))}
        branches={[]}
        tagSuggestions={tagSuggestions}
        canManageCategories={isOwner(ctx)}
        brandTax={brandTax}
        canManageTax={isOwner(ctx)}
        readOnly={!canEdit}
        archived={archived}
        slots={{ media: mediaSlot, inventory: inventorySlot, main: mainSlot, side: sideSlot }}
      />
    </>
  );
}
