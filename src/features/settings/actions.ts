'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { invalidatePublic } from '@/lib/public-cache';
import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { sendTestAlert } from '@/features/payments/alerts';
import { bankColumns, bankFieldsSchema } from '@/features/payments/lib/bank-form';
import { formDataToObject, zCheckbox, zOptionalText, zText } from '@/lib/validation';

const zOptionalUrl = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.url({ protocol: /^https?$/, error: 'Đường dẫn phải bắt đầu bằng https://' }).optional(),
  );

const brandSchema = z.object({
  name: zText('tên thương hiệu', 2, 80),
  hotline: zOptionalText(20),
  email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.email('Email không hợp lệ').optional()),
  address_line: zOptionalText(250),
  website_url: zOptionalUrl(),
  facebook_url: zOptionalUrl(),
  zalo_url: zOptionalUrl(),
  payment_instructions: zOptionalText(1000),
});

export async function updateBrandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = brandSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('brand_settings')
    .update({
      name: v.name,
      hotline: v.hotline ?? null,
      email: v.email ?? null,
      address_line: v.address_line ?? null,
      website_url: v.website_url ?? null,
      facebook_url: v.facebook_url ?? null,
      zalo_url: v.zalo_url ?? null,
      payment_instructions: v.payment_instructions ?? null,
    })
    .eq('id', true);
  if (error) return formDbError(error);
  revalidatePath('/', 'layout');
  invalidatePublic('brand');
  return formSuccess('Đã lưu thông tin thương hiệu.');
}

const taxSchema = z.object({
  tax_method: z.enum(['deduction', 'direct'], { error: 'Chọn cách tính thuế' }),
  default_vat_rate: z.preprocess(
    (v) => (typeof v === 'string' ? Number(v.replace(',', '.').replace('%', '').trim()) : v),
    z.number({ error: 'Nhập mức VAT' }).min(0, 'Không được âm').max(20, 'Tối đa 20%'),
  ),
  tax_code: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.replace(/\s/g, '') : v),
    z
      .string()
      .regex(/^[0-9]{10}(-[0-9]{3})?$/, 'Mã số thuế gồm 10 số (hoặc 10 số-3 số với chi nhánh)')
      .optional(),
  ),
});

/** Cách tính thuế dùng cho mọi sản phẩm (chỉ chủ sân; database chặn bằng RLS). */
export async function updateTaxSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = taxSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('brand_settings')
    .update({ tax_method: v.tax_method, default_vat_rate: v.default_vat_rate, tax_code: v.tax_code ?? null })
    .eq('id', true);
  if (error) return formDbError(error);
  revalidatePath('/admin', 'layout');
  invalidatePublic('brand');
  return formSuccess('Đã lưu cài đặt thuế. Đơn bán mới sẽ tính theo cài đặt này; đơn cũ giữ nguyên.');
}

/** Tài khoản nhận cọc chuyển khoản (SePay) + tự xác nhận đơn khi đủ cọc. */
export async function updateBankSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const raw = formDataToObject(formData);
  const parsed = bankFieldsSchema.safeParse(raw);
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('brand_settings')
    .update({ ...bankColumns(parsed.data), transfer_auto_confirm: formData.get('transfer_auto_confirm') === 'on' })
    .eq('id', true);
  if (error) return formDbError(error);
  revalidatePath('/admin', 'layout');
  invalidatePublic('brand');
  return formSuccess(
    parsed.data.bank_code
      ? 'Đã lưu tài khoản nhận cọc. Khách sẽ thấy mã QR chuyển khoản ngay sau khi giữ sân.'
      : 'Đã tắt chuyển khoản qua mã QR (khách đặt cọc theo hướng dẫn / tại quầy).',
  );
}

const notificationSchema = z.object({
  alert_emails: z
    .string()
    .max(500)
    .transform((v) => [
      ...new Set(
        v
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    ])
    .superRefine((list, ctx) => {
      const bad = list.find((e) => !z.email().safeParse(e).success);
      if (bad) ctx.addIssue({ code: 'custom', message: `Email không hợp lệ: ${bad}` });
      else if (list.length > 5) ctx.addIssue({ code: 'custom', message: 'Tối đa 5 email' });
    }),
  alert_on_review: zCheckbox(),
  alert_on_unmatched: zCheckbox(),
});

/** Email nhận cảnh báo giao dịch cần xử lý (trống = email tài khoản chủ sân). */
export async function updateNotificationSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = notificationSchema.safeParse({
    alert_emails: formData.get('alert_emails') ?? '',
    alert_on_review: formData.get('alert_on_review'),
    alert_on_unmatched: formData.get('alert_on_unmatched'),
  });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('notification_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) return formDbError(error, 'Chưa lưu được — đã chạy 16_alerts_reconcile.sql chưa?');
  revalidatePath('/admin/settings');
  return formSuccess('Đã lưu cài đặt thông báo.');
}

/** Gửi một email mẫu để kiểm tra khóa Resend và hộp thư nhận. */
export async function sendTestAlertAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireOwner();
  const result = await sendTestAlert();
  if (!result.ok) return formError(result.message);
  return formSuccess(`Đã gửi email thử tới ${result.recipients.join(', ')} — kiểm tra cả thư mục Spam.`);
}

export type SpeedReport = {
  /** Vùng máy chủ Vercel đang chạy trang (null khi chạy trên máy cá nhân). */
  region: string | null;
  /** Thời gian mỗi lượt hỏi database (ms), đo tuần tự. */
  samples: number[];
  best: number;
  median: number;
};

/**
 * Đo thời gian 1 lượt hỏi Supabase từ máy chủ web (chủ sân). Mỗi trang quản trị cần 1–2 lượt như vậy, nên con số
 * này gần như quyết định tốc độ mở trang: dưới ~30 ms là máy chủ web và database cùng vùng; trên ~150 ms là
 * hai bên ở xa nhau (ví dụ Vercel ở Mỹ, Supabase ở Singapore).
 */
export async function measureServerSpeedAction(): Promise<SpeedReport> {
  await requireOwner();
  const supabase = await createClient();
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await supabase.from('brand_settings').select('name').limit(1).maybeSingle();
    samples.push(Math.round(performance.now() - t0));
  }
  // Lượt đầu có thể gồm bắt tay TLS — bỏ khi lấy trung vị.
  const warm = samples.slice(1).toSorted((a, b) => a - b);
  return {
    region: process.env.VERCEL_REGION ?? null,
    samples,
    best: Math.min(...samples),
    median: warm[Math.floor(warm.length / 2)] ?? samples[0] ?? 0,
  };
}
