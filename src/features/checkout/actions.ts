'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireStaff } from '@/lib/auth/guards';
import { toUserMessage } from '@/lib/errors';
import { formatMinutes, formatVnd } from '@/lib/format';
import { formDbError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { zIdempotencyKey, zMoney, zOptionalText, zUuid } from '@/lib/validation';

export interface CheckoutStatus {
  total: number;
  paid: number;
  due: number;
}

/** Số tiền còn phải thu của đơn (màn hình chờ khách chuyển khoản hỏi lại vài giây một lần). */
export async function getCheckoutStatusAction(bookingId: string): Promise<CheckoutStatus | null> {
  await requireStaff();
  if (!z.uuid().safeParse(bookingId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('booking_balances')
    .select('total_amount, paid_amount, refunded_amount, balance_due')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (!data) return null;
  return {
    total: data.total_amount ?? 0,
    paid: (data.paid_amount ?? 0) - (data.refunded_amount ?? 0),
    due: Math.max(0, data.balance_due ?? 0),
  };
}

const checkoutSchema = z.object({
  booking_id: zUuid('đơn'),
  amount: zMoney('Số tiền', { min: 1000 }),
  method: z.enum(['cash', 'bank_transfer', 'card', 'e_wallet'], { error: 'Chọn hình thức thanh toán' }),
  reference: zOptionalText(100),
  idempotency_key: zIdempotencyKey(),
});

/** Thu tiền sân tại quầy (database kiểm tra quyền thu tiền ở chi nhánh của đơn, chống ghi trùng). */
export async function collectBookingPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_booking_payment', {
    p_booking_id: v.booking_id,
    p_amount: v.amount,
    p_method: v.method,
    p_reference: v.reference,
    p_note: 'Thu tại quầy',
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return formDbError(error);
  revalidatePath('/admin/checkout');
  revalidatePath(`/admin/bookings/${v.booking_id}`);
  revalidatePath('/admin/bookings');
  return formSuccess(`Đã thu ${v.amount.toLocaleString('vi-VN')} ₫.`);
}

const extendSchema = z.object({ bookingId: z.uuid(), newEnd: z.iso.datetime({ offset: true }) });

/** Khách chơi thêm: kéo dài giờ kết thúc, cộng tiền phần thêm theo bảng giá (database kiểm tra sân trống). */
export async function extendBookingAction(
  bookingId: string,
  newEnd: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireStaff();
  const parsed = extendSchema.safeParse({ bookingId, newEnd });
  if (!parsed.success) return { ok: false, error: 'Giờ gia hạn không hợp lệ.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('extend_booking', { p_booking_id: bookingId, p_new_end: newEnd, p_note: 'Thu tiền tại quầy' });
  if (error) return { ok: false, error: toUserMessage(error) };
  const res = z.object({ extended_minutes: z.number(), extra_amount: z.number() }).safeParse(data);
  revalidatePath(`/admin/checkout/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/checkout');
  revalidatePath('/admin/bookings');
  return {
    ok: true,
    message: res.success
      ? `Đã gia hạn thêm ${formatMinutes(res.data.extended_minutes)}, cộng ${formatVnd(res.data.extra_amount)}.`
      : 'Đã gia hạn giờ chơi.',
  };
}
