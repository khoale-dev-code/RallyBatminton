'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { setFlash } from '@/lib/flash';
import { invalidatePublic } from '@/lib/public-cache';
import { requireBranchPermission } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import {
  formDataToObject,
  zCheckbox,
  zIdempotencyKey,
  zInt,
  zManualPaymentMethod,
  zMoney,
  zOptionalMoney,
  zOptionalText,
  zOptionalUuid,
  zOptionalVnPhone,
  zUuid,
} from '@/lib/validation';

function revalidateRentals(id?: string) {
  revalidatePath('/admin/rentals');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin');
  if (id) revalidatePath(`/admin/rentals/${id}`);
  invalidatePublic('catalog');
}

const checkoutSchema = z
  .object({
    product_id: zUuid('đồ cho thuê'),
    variant_id: zOptionalUuid(),
    rate_id: zUuid('gói thuê'),
    quantity: zInt('Số lượng', 1, 50),
    booking_id: zOptionalUuid(),
    customer_phone: zOptionalVnPhone(),
    customer_name: zOptionalText(80),
    collateral: zOptionalText(120),
    collect_payment: zCheckbox(),
    payment_method: zManualPaymentMethod(),
    payment_reference: zOptionalText(100),
    note: zOptionalText(300),
    idempotency_key: zIdempotencyKey(),
  })
  .superRefine((v, ctx) => {
    // Gắn lượt đặt sân thì được bỏ trống khách (lấy khách của lượt đặt).
    if (v.booking_id) return;
    if (!v.customer_phone) ctx.addIssue({ code: 'custom', path: ['customer_phone'], message: 'Nhập số điện thoại khách' });
    if (!v.customer_name || v.customer_name.length < 2)
      ctx.addIssue({ code: 'custom', path: ['customer_name'], message: 'Nhập tên khách' });
  });

export async function checkoutRentalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { branch } = await requireBranchPermission('rental.operate');
  const parsed = checkoutSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('checkout_rental', {
    p_branch_id: branch.branchId,
    p_product_id: v.product_id,
    p_rate_id: v.rate_id,
    p_quantity: v.quantity,
    p_customer_phone: v.customer_phone ?? '',
    p_customer_name: v.customer_name ?? '',
    p_variant_id: v.variant_id,
    p_collect_payment: v.collect_payment,
    p_payment_method: v.payment_method,
    p_payment_reference: v.payment_reference,
    p_note: v.note,
    p_idempotency_key: v.idempotency_key,
    p_booking_id: v.booking_id,
    p_collateral: v.collateral,
  });
  if (error) return formDbError(error);
  const res = z.object({ rental_id: z.uuid() }).safeParse(data);
  if (!res.success) return formError('Không đọc được phiếu thuê vừa tạo.');
  revalidateRentals();
  await setFlash('Đã tạo phiếu thuê.');
  redirect(`/admin/rentals/${res.data.rental_id}`);
}

const returnSchema = z
  .object({
    late_mode: z.enum(['auto', 'custom']).default('auto'),
    late_fee: zOptionalMoney('Phí trả trễ'),
    late_fee_reason: zOptionalText(200),
    damage_fee: zOptionalMoney('Phí hư hỏng'),
    note: zOptionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.late_mode !== 'custom') return;
    if (v.late_fee === undefined) ctx.addIssue({ code: 'custom', path: ['late_fee'], message: 'Nhập số tiền phụ phí thu' });
    if (!v.late_fee_reason || v.late_fee_reason.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['late_fee_reason'], message: 'Ghi lý do giảm phụ phí' });
    }
  });

/** Nhận trả: mỗi dòng có ô returned_/damaged_/lost_<variantId>. Món hư/mất không cộng lại kho. */
export async function returnRentalAction(rentalId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireBranchPermission('rental.operate');
  const parsed = returnSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data: lines } = await supabase.from('rental_lines').select('variant_id, quantity').eq('rental_id', rentalId);
  if (!lines || lines.length === 0) return formError('Không tìm thấy phiếu thuê.');

  const qty = zInt('Số lượng', 0, 1000);
  const payload: Array<{ variant_id: string; returned: number; damaged: number; lost: number }> = [];
  for (const line of lines) {
    const read = (prefix: string, fallback: number) => {
      const raw = formData.get(`${prefix}_${line.variant_id}`);
      const r = qty.safeParse(typeof raw === 'string' && raw !== '' ? raw : fallback);
      return r.success ? r.data : null;
    };
    const damaged = read('damaged', 0);
    const lost = read('lost', 0);
    const returned = read('returned', line.quantity - (damaged ?? 0) - (lost ?? 0));
    if (returned === null || damaged === null || lost === null || returned + damaged + lost !== line.quantity) {
      return formError(`Tổng trả + hư + mất phải bằng ${line.quantity} cho mỗi món.`);
    }
    payload.push({ variant_id: line.variant_id, returned, damaged, lost });
  }
  const { error } = await supabase.rpc('return_rental', {
    p_rental_id: rentalId,
    p_lines: payload,
    // auto: database tự tính phụ phí tại thời điểm nhận trả.
    p_late_fee: parsed.data.late_mode === 'custom' ? parsed.data.late_fee : undefined,
    p_damage_fee: parsed.data.damage_fee ?? 0,
    p_note: parsed.data.note,
    p_late_fee_reason: parsed.data.late_mode === 'custom' ? parsed.data.late_fee_reason : undefined,
  });
  if (error) return formDbError(error);
  revalidateRentals(rentalId);
  return formSuccess('Đã nhận trả. Hàng tốt đã cộng lại vào kho; phụ phí (nếu có) đã cộng vào số còn phải thu.');
}

const paymentSchema = z.object({
  amount: zMoney('Số tiền', { min: 1000 }),
  method: zManualPaymentMethod(),
  reference: zOptionalText(100),
  idempotency_key: zIdempotencyKey(),
});

export async function recordRentalPaymentAction(rentalId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireBranchPermission('rental.operate');
  const parsed = paymentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_rental_payment', {
    p_rental_id: rentalId,
    p_amount: v.amount,
    p_method: v.method,
    p_reference: v.reference,
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return formDbError(error);
  revalidateRentals(rentalId);
  return formSuccess('Đã ghi nhận thanh toán.');
}
