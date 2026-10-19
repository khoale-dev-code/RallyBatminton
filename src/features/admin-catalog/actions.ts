'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { invalidatePublic } from '@/lib/public-cache';
import { requireBranchPermission, requireOwner } from '@/lib/auth/guards';
import { errorCode, toUserMessage } from '@/lib/errors';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { slugify } from '@/lib/slug';
import { MEDIA_BUCKET } from '@/lib/storage';
import { type Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { RENTAL_RATE_KINDS } from '@/lib/labels';
import { formDataToObject, zCheckbox, zInt, zMoney, zOptionalMoney, zOptionalText, zText, zUuid } from '@/lib/validation';

import { payloadErrors, productPayloadSchema, type PayloadErrors, type ProductPayload } from './lib/product-payload';

/** Quyền sửa danh mục áp dụng toàn thương hiệu; RLS kiểm lại ở database. */
async function requireCatalogEditor() {
  return requireBranchPermission('catalog.edit');
}

function revalidateCatalog(productId?: string) {
  revalidatePath('/products');
  revalidatePath('/rentals');
  revalidatePath('/admin/catalog');
  invalidatePublic('catalog');
  if (productId) {
    revalidatePath(`/admin/catalog/${productId}`);
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/rentals/${productId}`);
    invalidatePublic('catalog');
  }
}

// ---------------------------------------------------------------------------
// Màn hình thêm/sửa sản phẩm đầy đủ (một lần lưu: thông tin, giá, biến thể, tồn đầu kỳ)
// ---------------------------------------------------------------------------
export type EditorResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: PayloadErrors };

/** Lỗi ràng buộc database → ô nhập tương ứng (để mở đúng khung và tô đỏ). */
function dbFieldError(err: unknown): PayloadErrors | undefined {
  const text = JSON.stringify(err);
  if (/product_variants_sku_key/.test(text)) return { 'variants.0.sku': 'SKU đã có ở sản phẩm khác' };
  if (/product_variants_barcode_uidx/.test(text)) return { 'variants.0.barcode': 'Mã vạch đã có ở sản phẩm khác' };
  if (/products_compare_price/.test(text)) return { compare_at_price: 'Giá so sánh phải lớn hơn giá bán' };
  return undefined;
}

export async function createProductFullAction(input: ProductPayload): Promise<EditorResult> {
  await requireCatalogEditor();
  const parsed = productPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Vui lòng kiểm tra các ô được đánh dấu.', fieldErrors: payloadErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_product_full', { p: parsed.data as unknown as Json });
  if (error || !data) {
    return { ok: false, error: toUserMessage(error, 'Không tạo được sản phẩm.'), fieldErrors: error ? dbFieldError(error) : undefined };
  }
  revalidateCatalog(data);
  revalidatePath('/admin/inventory');
  invalidatePublic('catalog');
  return { ok: true, id: data };
}

export async function updateProductFullAction(productId: string, input: ProductPayload): Promise<EditorResult> {
  await requireCatalogEditor();
  if (!zUuid().safeParse(productId).success) return { ok: false, error: 'Sản phẩm không hợp lệ.' };
  const parsed = productPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Vui lòng kiểm tra các ô được đánh dấu.', fieldErrors: payloadErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_product_full', { p_id: productId, p: parsed.data as unknown as Json });
  if (error) {
    const code = errorCode(error);
    return {
      ok: false,
      error: toUserMessage(error, code === 'PERMISSION_DENIED' ? 'Bạn không có quyền sửa sản phẩm.' : 'Không lưu được sản phẩm.'),
      fieldErrors: dbFieldError(error),
    };
  }
  revalidateCatalog(productId);
  revalidatePath('/admin/inventory');
  invalidatePublic('catalog');
  return { ok: true, id: productId };
}

// ---------------------------------------------------------------------------
// Sản phẩm
// ---------------------------------------------------------------------------
/** Ngừng kinh doanh (xóa mềm) — lịch sử bán/thuê vẫn giữ nguyên. */
export async function archiveProductAction(productId: string, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { error } = await supabase.from('products').update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', productId);
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã ngừng kinh doanh sản phẩm. Lịch sử giao dịch vẫn được giữ.');
}

export async function restoreProductAction(productId: string, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { error } = await supabase.from('products').update({ deleted_at: null, is_active: true }).eq('id', productId);
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã mở bán lại sản phẩm.');
}

// ---------------------------------------------------------------------------
// Ảnh
// ---------------------------------------------------------------------------
export async function addProductPhotoAction(productId: string, path: string): Promise<FormState> {
  await requireCatalogEditor();
  if (!path.startsWith(`products/${productId}/`)) return formError('Đường dẫn ảnh không hợp lệ.');
  const supabase = await createClient();
  const { count } = await supabase.from('product_photos').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  const { error } = await supabase.from('product_photos').insert({
    product_id: productId,
    storage_path: path,
    sort_order: count ?? 0,
    is_cover: (count ?? 0) === 0,
  });
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã thêm ảnh.');
}

export async function setProductCoverAction(photoId: string, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { data: photo } = await supabase.from('product_photos').select('product_id').eq('id', photoId).maybeSingle();
  if (!photo) return formError('Không tìm thấy ảnh.');
  await supabase.from('product_photos').update({ is_cover: false }).eq('product_id', photo.product_id);
  const { error } = await supabase.from('product_photos').update({ is_cover: true }).eq('id', photoId);
  if (error) return formDbError(error);
  revalidateCatalog(photo.product_id);
  return formSuccess('Đã đặt làm ảnh chính.');
}

export async function deleteProductPhotoAction(photoId: string, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { data: photo } = await supabase.from('product_photos').select('product_id, storage_path').eq('id', photoId).maybeSingle();
  if (!photo) return formError('Không tìm thấy ảnh.');
  const { error } = await supabase.from('product_photos').delete().eq('id', photoId);
  if (error) return formDbError(error);
  await supabase.storage.from(MEDIA_BUCKET).remove([photo.storage_path]);
  revalidateCatalog(photo.product_id);
  return formSuccess('Đã xóa ảnh.');
}

// ---------------------------------------------------------------------------
// Giá thuê & combo
// ---------------------------------------------------------------------------
const zOptionalMinutes = (label: string, min: number, max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zInt(label, min, max).optional());

const rateSchema = z.object({
  kind: z.enum(
    RENTAL_RATE_KINDS.map((k) => k.value),
    { error: 'Chọn hình thức' },
  ),
  label: zText('tên gói', 1, 40),
  duration_minutes: zInt('Thời lượng (phút)', 15, 10080),
  price: zMoney('Giá thuê', { min: 1000, max: 100_000_000 }),
  grace_minutes: zOptionalMinutes('Ân hạn (phút)', 0, 240),
  overtime_block_minutes: zOptionalMinutes('Block tính phụ phí (phút)', 5, 1440),
  overtime_block_price: zOptionalMoney('Giá mỗi block'),
  overtime_cap: zOptionalMoney('Trần phụ phí'),
});

/** Dữ liệu ghi rental_rates; ô chính sách bỏ trống = database tự điền mặc định theo hình thức. */
function rateRow(v: z.infer<typeof rateSchema>) {
  const kind = RENTAL_RATE_KINDS.find((k) => k.value === v.kind) ?? RENTAL_RATE_KINDS[0];
  return {
    label: v.label,
    duration_minutes: v.duration_minutes,
    price: v.price,
    usage: kind.usage,
    billing: kind.billing,
    grace_minutes: v.grace_minutes,
    overtime_block_minutes: v.overtime_block_minutes,
    overtime_block_price: v.overtime_block_price ?? null,
    overtime_cap: v.overtime_cap ?? null,
  };
}

export async function addRentalRateAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCatalogEditor();
  const parsed = rateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('rental_rates').insert({ product_id: productId, ...rateRow(parsed.data) });
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã thêm gói giá thuê.');
}

/** Sửa gói: an toàn với phiếu cũ vì giá & chính sách đã được chụp vào từng phiếu thuê. */
export async function updateRentalRateAction(rateId: string, productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCatalogEditor();
  const parsed = rateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  // Ô ân hạn/block bỏ trống (undefined) không được gửi đi = giữ nguyên giá trị đang có.
  const { error } = await supabase.from('rental_rates').update(rateRow(parsed.data)).eq('id', rateId).eq('product_id', productId);
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  revalidatePath('/admin/rentals');
  invalidatePublic('catalog');
  return formSuccess('Đã lưu gói giá thuê.');
}

export async function toggleRentalRateAction(rateId: string, productId: string, active: boolean, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { error } = await supabase.from('rental_rates').update({ is_active: active }).eq('id', rateId).eq('product_id', productId);
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess(active ? 'Đã bật gói giá.' : 'Đã tắt gói giá.');
}

const componentSchema = z.object({ component_variant_id: zUuid('món thành phần'), quantity: zInt('Số lượng', 1, 50) });

export async function addBundleComponentAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCatalogEditor();
  const parsed = componentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('bundle_components')
    .upsert({ bundle_product_id: productId, ...parsed.data }, { onConflict: 'bundle_product_id,component_variant_id' });
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã cập nhật thành phần combo.');
}

export async function removeBundleComponentAction(productId: string, variantId: string, _prev: FormState): Promise<FormState> {
  await requireCatalogEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from('bundle_components')
    .delete()
    .eq('bundle_product_id', productId)
    .eq('component_variant_id', variantId);
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  return formSuccess('Đã bỏ thành phần.');
}

// ---------------------------------------------------------------------------
// Hiển thị theo chi nhánh (is_listed, mức cảnh báo tồn)
// ---------------------------------------------------------------------------
const listingSchema = z.object({
  branch_id: zUuid('chi nhánh'),
  variant_id: zUuid('biến thể'),
  reorder_level: zInt('Mức cảnh báo', 0, 100000),
  is_listed: zCheckbox(),
});

export async function setBranchListingAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCatalogEditor();
  const parsed = listingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('inventory_levels')
    .upsert(
      { branch_id: v.branch_id, variant_id: v.variant_id, reorder_level: v.reorder_level, is_listed: v.is_listed },
      { onConflict: 'branch_id,variant_id' },
    );
  if (error) return formDbError(error);
  revalidateCatalog(productId);
  revalidatePath('/admin/inventory');
  invalidatePublic('catalog');
  return formSuccess('Đã lưu cài đặt chi nhánh.');
}

// ---------------------------------------------------------------------------
// Nhóm hàng (chỉ chủ sân)
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  name: zText('tên nhóm', 2, 60),
  slug: zOptionalText(60),
  sort_order: zInt('Thứ tự', 0, 999),
});

export async function createCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = categorySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('product_categories')
    .insert({ name: v.name, slug: slugify(v.slug ?? v.name), sort_order: v.sort_order });
  if (error) return formDbError(error);
  revalidatePath('/admin/catalog/categories');
  invalidatePublic('catalog');
  revalidateCatalog();
  return formSuccess('Đã thêm nhóm hàng.');
}

export async function updateCategoryAction(categoryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = categorySchema.extend({ is_active: zCheckbox() }).safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('product_categories')
    .update({ name: v.name, slug: slugify(v.slug ?? v.name), sort_order: v.sort_order, is_active: v.is_active })
    .eq('id', categoryId);
  if (error) return formDbError(error);
  revalidatePath('/admin/catalog/categories');
  invalidatePublic('catalog');
  revalidateCatalog();
  return formSuccess('Đã lưu nhóm hàng.');
}
