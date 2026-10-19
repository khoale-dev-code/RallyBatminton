'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { parseMapEmbed } from '@/features/branches/lib/map-embed';
import { setFlash } from '@/lib/flash';
import { invalidatePublic } from '@/lib/public-cache';
import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { slugify } from '@/lib/slug';
import { MEDIA_BUCKET } from '@/lib/storage';
import { Constants } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { formDataStrings, zCheckbox, zDateKey, zInt, zMoney, zOptionalText, zOptionalUuid, zText, zTime } from '@/lib/validation';
import { bankColumns, bankFieldsSchema } from '@/features/payments/lib/bank-form';

/** Làm mới trang công khai sau khi đổi dữ liệu chi nhánh/sân/giá. */
function revalidatePublic(slug?: string | null) {
  revalidatePath('/');
  revalidatePath('/branches');
  if (slug) revalidatePath(`/branches/${slug}`);
  invalidatePublic('branches');
}

// ---------------------------------------------------------------------------
// Chi nhánh
// ---------------------------------------------------------------------------
const branchCreateSchema = z.object({
  name: zText('tên chi nhánh', 2, 120),
  slug: zOptionalText(60),
  address_line: zText('địa chỉ', 5, 250),
  ward: zOptionalText(80),
  district: zOptionalText(80),
  city: zText('tỉnh/thành phố', 2, 80),
  phone: zOptionalText(20),
});

export async function createBranchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = branchCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branches')
    .insert({
      name: v.name,
      slug: slugify(v.slug ?? v.name),
      address_line: v.address_line,
      ward: v.ward ?? null,
      district: v.district ?? null,
      city: v.city,
      phone: v.phone ?? null,
    })
    .select('id')
    .single();
  if (error) return formDbError(error);
  await setFlash('Đã tạo chi nhánh. Thêm sân và bảng giá để công bố.');
  redirect(`/admin/branches/${data.id}/courts?created=1`);
}

const timeOrMidnight = zTime('giờ');

const branchUpdateSchema = branchCreateSchema
  .extend({
    slug: zText('đường dẫn', 2, 60).transform(slugify),
    latitude: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
    map_url: zOptionalText(500),
    map_embed: z.string().max(4000, 'Mã nhúng quá dài.').optional(),
    opens_at: timeOrMidnight,
    closes_at: timeOrMidnight,
    slot_minutes: z.enum(['30', '60']).transform(Number),
    hold_minutes: zInt('Thời gian giữ chỗ', 5, 30),
    min_booking_minutes: zInt('Thời lượng tối thiểu', 30, 720),
    max_booking_minutes: zInt('Thời lượng tối đa', 30, 720),
    booking_window_days: zInt('Số ngày đặt trước', 1, 90),
    deposit_percent: zInt('Tỉ lệ cọc', 0, 100),
    free_cancel_hours: zInt('Mốc hoàn toàn bộ', 0, 720),
    partial_refund_hours: zInt('Mốc hoàn một phần', 0, 720),
    partial_refund_percent: zInt('Tỉ lệ hoàn một phần', 0, 100),
    description: zOptionalText(2000),
    parking_info: zOptionalText(500),
    house_rules: zOptionalText(2000),
  })
  .refine((v) => v.max_booking_minutes >= v.min_booking_minutes, {
    path: ['max_booking_minutes'],
    message: 'Tối đa phải lớn hơn hoặc bằng tối thiểu',
  })
  .refine((v) => v.free_cancel_hours >= v.partial_refund_hours, {
    path: ['free_cancel_hours'],
    message: 'Mốc hoàn toàn bộ phải lớn hơn hoặc bằng mốc hoàn một phần',
  });

export async function updateBranchAction(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const raw = Object.fromEntries(formData);
  const parsed = branchUpdateSchema.safeParse(raw);
  if (!parsed.success) return formZodError(parsed.error);
  const bank = bankFieldsSchema.safeParse(raw);
  if (!bank.success) return formZodError(bank.error);
  const v = parsed.data;
  const embed = parseMapEmbed(v.map_embed);
  if (!embed.ok) return formError(embed.error, { map_embed: embed.error });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branches')
    .update({
      name: v.name,
      slug: v.slug,
      address_line: v.address_line,
      ward: v.ward ?? null,
      district: v.district ?? null,
      city: v.city,
      phone: v.phone ?? null,
      latitude: v.latitude ?? null,
      longitude: v.longitude ?? null,
      map_url: v.map_url ?? null,
      map_embed_url: embed.url,
      opens_at: v.opens_at,
      closes_at: v.closes_at,
      slot_minutes: v.slot_minutes,
      hold_minutes: v.hold_minutes,
      min_booking_minutes: v.min_booking_minutes,
      max_booking_minutes: v.max_booking_minutes,
      booking_window_days: v.booking_window_days,
      deposit_percent: v.deposit_percent,
      free_cancel_hours: v.free_cancel_hours,
      partial_refund_hours: v.partial_refund_hours,
      partial_refund_percent: v.partial_refund_percent,
      description: v.description ?? null,
      parking_info: v.parking_info ?? null,
      house_rules: v.house_rules ?? null,
      ...bankColumns(bank.data),
    })
    .eq('id', branchId)
    .select('slug')
    .single();
  if (error) return formDbError(error);
  revalidatePublic(data.slug);
  revalidatePath(`/admin/branches/${branchId}`);
  invalidatePublic('branches');
  return formSuccess('Đã lưu thông tin chi nhánh.');
}

const statusSchema = z.enum(Constants.public.Enums.branch_status);

export async function setBranchStatusAction(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = statusSchema.safeParse(formData.get('status'));
  if (!parsed.success) return formError('Trạng thái không hợp lệ.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branches')
    .update({ status: parsed.data, deleted_at: parsed.data === 'archived' ? new Date().toISOString() : null })
    .eq('id', branchId)
    .select('slug')
    .single();
  if (error) return formDbError(error);
  revalidatePublic(data.slug);
  revalidatePath(`/admin/branches/${branchId}`);
  revalidatePath('/admin/branches');
  invalidatePublic('branches');
  const messages: Record<z.infer<typeof statusSchema>, string> = {
    published: 'Đã công bố — khách có thể đặt sân.',
    paused: 'Đã tạm ngưng nhận đặt trực tuyến.',
    draft: 'Đã chuyển về bản nháp.',
    archived: 'Đã đóng chi nhánh (dữ liệu lịch sử được giữ nguyên).',
  };
  return formSuccess(messages[parsed.data]);
}

export async function setBranchAmenitiesAction(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const codes = formDataStrings(formData, 'amenities').filter((c) => /^[a-z][a-z0-9_]{1,39}$/.test(c));
  const supabase = await createClient();
  const { error: delError } = await supabase.from('branch_amenities').delete().eq('branch_id', branchId);
  if (delError) return formDbError(delError);
  if (codes.length > 0) {
    const { error } = await supabase.from('branch_amenities').insert(codes.map((amenity_code) => ({ branch_id: branchId, amenity_code })));
    if (error) return formDbError(error);
  }
  const { data } = await supabase.from('branches').select('slug').eq('id', branchId).maybeSingle();
  revalidatePublic(data?.slug);
  return formSuccess('Đã lưu tiện ích.');
}

export async function setBranchCoverAction(branchId: string, path: string): Promise<FormState> {
  await requireOwner();
  if (!path.startsWith(`branches/${branchId}/`)) return formError('Đường dẫn ảnh không hợp lệ.');
  const supabase = await createClient();
  const { data: old } = await supabase.from('branches').select('cover_image_path, slug').eq('id', branchId).maybeSingle();
  const { error } = await supabase.from('branches').update({ cover_image_path: path }).eq('id', branchId);
  if (error) return formDbError(error);
  if (old?.cover_image_path) await supabase.storage.from(MEDIA_BUCKET).remove([old.cover_image_path]);
  revalidatePublic(old?.slug);
  return formSuccess('Đã cập nhật ảnh bìa.');
}

// ---------------------------------------------------------------------------
// Sân
// ---------------------------------------------------------------------------
const courtSchema = z.object({
  name: zText('tên sân', 1, 60),
  surface_code: zOptionalText(40),
  is_indoor: zCheckbox(),
  sort_order: zInt('Thứ tự', 0, 999),
  description: zOptionalText(800),
});

export async function createCourtAction(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = courtSchema.safeParse({ ...Object.fromEntries(formData), is_indoor: formData.get('is_indoor') });
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('courts').insert({
    branch_id: branchId,
    name: v.name,
    surface_code: v.surface_code ?? null,
    is_indoor: v.is_indoor,
    sort_order: v.sort_order,
    description: v.description ?? null,
  });
  if (error) return formDbError(error);
  revalidatePath(`/admin/branches/${branchId}/courts`);
  invalidatePublic('branches');
  return formSuccess(`Đã thêm ${v.name}.`);
}

const courtUpdateSchema = courtSchema.extend({ status: z.enum(Constants.public.Enums.court_status) });

export async function updateCourtAction(courtId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = courtUpdateSchema.safeParse({ ...Object.fromEntries(formData), is_indoor: formData.get('is_indoor') });
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courts')
    .update({
      name: v.name,
      surface_code: v.surface_code ?? null,
      is_indoor: v.is_indoor,
      sort_order: v.sort_order,
      description: v.description ?? null,
      status: v.status,
    })
    .eq('id', courtId)
    .select('branch_id, branches(slug)')
    .single();
  if (error) return formDbError(error);
  revalidatePublic(data.branches?.slug);
  revalidatePath(`/admin/branches/${data.branch_id}/courts`);
  invalidatePublic('branches');
  return formSuccess('Đã lưu sân.');
}

export async function addCourtPhotoAction(courtId: string, path: string): Promise<FormState> {
  await requireOwner();
  if (!path.startsWith(`courts/${courtId}/`)) return formError('Đường dẫn ảnh không hợp lệ.');
  const supabase = await createClient();
  const { count } = await supabase.from('court_photos').select('id', { count: 'exact', head: true }).eq('court_id', courtId);
  const { error } = await supabase.from('court_photos').insert({
    court_id: courtId,
    storage_path: path,
    sort_order: count ?? 0,
    is_cover: (count ?? 0) === 0,
  });
  if (error) return formDbError(error);
  invalidatePublic('branches');
  return formSuccess('Đã thêm ảnh.');
}

export async function setCourtCoverAction(photoId: string, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { data: photo } = await supabase.from('court_photos').select('court_id').eq('id', photoId).maybeSingle();
  if (!photo) return formError('Không tìm thấy ảnh.');
  await supabase.from('court_photos').update({ is_cover: false }).eq('court_id', photo.court_id);
  const { error } = await supabase.from('court_photos').update({ is_cover: true }).eq('id', photoId);
  if (error) return formDbError(error);
  revalidatePath(`/admin/courts/${photo.court_id}`);
  invalidatePublic('branches');
  return formSuccess('Đã đặt làm ảnh chính.');
}

export async function deleteCourtPhotoAction(photoId: string, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { data: photo } = await supabase.from('court_photos').select('court_id, storage_path').eq('id', photoId).maybeSingle();
  if (!photo) return formError('Không tìm thấy ảnh.');
  const { error } = await supabase.from('court_photos').delete().eq('id', photoId);
  if (error) return formDbError(error);
  await supabase.storage.from(MEDIA_BUCKET).remove([photo.storage_path]);
  revalidatePath(`/admin/courts/${photo.court_id}`);
  invalidatePublic('branches');
  return formSuccess('Đã xóa ảnh.');
}

// ---------------------------------------------------------------------------
// Bảng giá
// ---------------------------------------------------------------------------
const priceRuleSchema = z
  .object({
    court_id: zOptionalUuid(),
    label: zOptionalText(60),
    starts_at: zTime('giờ bắt đầu'),
    ends_at: zTime('giờ kết thúc'),
    price_per_hour: zMoney('Giá mỗi giờ', { min: 1000, max: 10_000_000 }),
    priority: zInt('Độ ưu tiên', -100, 100),
    valid_from: z.preprocess((v) => (v === '' ? undefined : v), zDateKey('ngày bắt đầu').optional()),
    valid_until: z.preprocess((v) => (v === '' ? undefined : v), zDateKey('ngày kết thúc').optional()),
  })
  .refine((v) => v.ends_at > v.starts_at, { path: ['ends_at'], message: 'Giờ kết thúc phải sau giờ bắt đầu' });

export async function createPriceRuleAction(branchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const days = formDataStrings(formData, 'days')
    .map(Number)
    .filter((d) => d >= 1 && d <= 7);
  const parsed = priceRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  if (days.length === 0) return formError('Chọn ít nhất một ngày áp dụng.', { days: 'Chọn ít nhất một ngày' });
  const v = parsed.data;
  const mask = days.reduce((m, d) => m | (1 << (d - 1)), 0);
  const supabase = await createClient();
  const { error } = await supabase.from('price_rules').insert({
    branch_id: branchId,
    court_id: v.court_id ?? null,
    label: v.label ?? null,
    days_mask: mask,
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    price_per_hour: v.price_per_hour,
    priority: v.priority,
    valid_from: v.valid_from ?? null,
    valid_until: v.valid_until ?? null,
  });
  if (error) return formDbError(error);
  const { data } = await supabase.from('branches').select('slug').eq('id', branchId).maybeSingle();
  revalidatePublic(data?.slug);
  revalidatePath(`/admin/branches/${branchId}/pricing`);
  invalidatePublic('branches');
  return formSuccess('Đã thêm quy tắc giá.');
}

export async function togglePriceRuleAction(ruleId: string, active: boolean, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('price_rules')
    .update({ is_active: active })
    .eq('id', ruleId)
    .select('branch_id, branches(slug)')
    .single();
  if (error) return formDbError(error);
  revalidatePublic(data.branches?.slug);
  revalidatePath(`/admin/branches/${data.branch_id}/pricing`);
  invalidatePublic('branches');
  return formSuccess(active ? 'Đã bật lại quy tắc.' : 'Đã tắt quy tắc (lịch sử vẫn được lưu).');
}
