'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { bookingSummarySchema } from '@/features/booking/schemas';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { type Constants } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { zonedToUtc } from '@/lib/time';
import {
  zCheckbox,
  zDateKey,
  zIdempotencyKey,
  zMoney,
  zOptionalMoney,
  zOptionalText,
  zText,
  zTime,
  zUuid,
  zVnPhone,
} from '@/lib/validation';

const manualMethods = z.enum(['cash', 'bank_transfer', 'card', 'e_wallet'] as const satisfies ReadonlyArray<
  (typeof Constants.public.Enums.payment_method)[number]
>);

function done(bookingId: string, message: string): FormState {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  return formSuccess(message);
}

async function branchTimezone(courtId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from('courts').select('branches(timezone)').eq('id', courtId).maybeSingle();
  return data?.branches?.timezone ?? 'Asia/Ho_Chi_Minh';
}

export async function confirmBookingAction(bookingId: string, _prev: FormState): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
  if (error) return formDbError(error);
  return done(bookingId, 'Đã xác nhận đơn.');
}

export async function checkInBookingAction(bookingId: string, _prev: FormState): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('check_in_booking', { p_booking_id: bookingId });
  if (error) return formDbError(error);
  return done(bookingId, 'Đã ghi nhận khách đến sân.');
}

const reasonSchema = z.object({ reason: zText('lý do', 3, 300) });

export async function markNoShowAction(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse({ reason: formData.get('reason') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_booking_no_show', { p_booking_id: bookingId, p_reason: parsed.data.reason });
  if (error) return formDbError(error);
  return done(bookingId, 'Đã đánh dấu khách không đến.');
}

export async function cancelBookingAction(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.extend({ waive: zCheckbox() }).safeParse({ reason: formData.get('reason'), waive: formData.get('waive') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: parsed.data.reason,
    p_waive_policy: parsed.data.waive,
  });
  if (error) return formDbError(error);
  const summary = bookingSummarySchema.safeParse(data);
  const refund = summary.success ? summary.data.refund_entitlement : null;
  return done(
    bookingId,
    refund && refund > 0
      ? `Đã hủy. Khách được hoàn ${refund.toLocaleString('vi-VN')} ₫ — ghi nhận hoàn tiền khi đã chuyển.`
      : 'Đã hủy đơn.',
  );
}

const rangeSchema = z
  .object({
    court_id: zUuid('sân'),
    date: zDateKey(),
    start: zTime('giờ bắt đầu'),
    end: zTime('giờ kết thúc'),
  })
  .refine((v) => v.end > v.start, { path: ['end'], message: 'Giờ kết thúc phải sau giờ bắt đầu' });

export async function rescheduleBookingAction(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rangeSchema.and(reasonSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const tz = await branchTimezone(v.court_id);
  const supabase = await createClient();
  const { error } = await supabase.rpc('reschedule_booking', {
    p_booking_id: bookingId,
    p_court_id: v.court_id,
    p_starts_at: zonedToUtc(v.date, v.start, tz).toISOString(),
    p_ends_at: zonedToUtc(v.date, v.end, tz).toISOString(),
    p_reason: v.reason,
  });
  if (error) return formDbError(error);
  return done(bookingId, 'Đã đổi lịch và tính lại giá.');
}

const paymentSchema = z.object({
  amount: zMoney('Số tiền', { min: 1000 }),
  method: manualMethods,
  reference: zOptionalText(100),
  note: zOptionalText(300),
  idempotency_key: zIdempotencyKey(),
});

export async function recordPaymentAction(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_booking_payment', {
    p_booking_id: bookingId,
    p_amount: v.amount,
    p_method: v.method,
    p_reference: v.reference,
    p_note: v.note,
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return formDbError(error);
  return done(bookingId, `Đã ghi nhận ${v.amount.toLocaleString('vi-VN')} ₫.`);
}

export async function recordRefundAction(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentSchema.extend({ note: zText('lý do hoàn', 3, 300) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_booking_refund', {
    p_booking_id: bookingId,
    p_amount: v.amount,
    p_method: v.method,
    p_reason: v.note,
    p_reference: v.reference,
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return formDbError(error);
  return done(bookingId, `Đã ghi nhận hoàn ${v.amount.toLocaleString('vi-VN')} ₫.`);
}

export async function voidPaymentAction(paymentId: string, bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse({ reason: formData.get('reason') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('void_payment', { p_payment_id: paymentId, p_reason: parsed.data.reason });
  if (error) return formDbError(error);
  return done(bookingId, 'Đã hủy giao dịch.');
}

const counterSchema = z
  .object({
    court_id: zUuid('sân'),
    date: zDateKey(),
    start: zTime('giờ bắt đầu'),
    end: zTime('giờ kết thúc'),
    phone: zVnPhone(),
    contact_name: zText('tên khách', 2, 80),
    internal_note: zOptionalText(500),
    discount: zOptionalMoney('Giảm giá'),
    hold_only: zCheckbox(),
    idempotency_key: zIdempotencyKey(),
  })
  .refine((v) => v.end > v.start, { path: ['end'], message: 'Giờ kết thúc phải sau giờ bắt đầu' });

export async function createCounterBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = counterSchema.safeParse({ ...Object.fromEntries(formData), hold_only: formData.get('hold_only') });
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const tz = await branchTimezone(v.court_id);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_counter_booking', {
    p_court_id: v.court_id,
    p_starts_at: zonedToUtc(v.date, v.start, tz).toISOString(),
    p_ends_at: zonedToUtc(v.date, v.end, tz).toISOString(),
    p_phone: v.phone,
    p_contact_name: v.contact_name,
    p_internal_note: v.internal_note,
    p_discount_amount: v.discount ?? 0,
    p_hold_only: v.hold_only,
    p_idempotency_key: v.idempotency_key,
  });
  if (error) return formDbError(error);
  const summary = bookingSummarySchema.safeParse(data);
  if (!summary.success) return formError('Đã tạo đơn nhưng không đọc được kết quả. Kiểm tra lịch đặt sân.');
  revalidatePath('/admin/bookings');
  redirect(`/admin/bookings/${summary.data.booking_id}`);
}

const blockSchema = rangeSchema.and(reasonSchema);

export async function createCourtBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const tz = await branchTimezone(v.court_id);
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_court_block', {
    p_court_id: v.court_id,
    p_starts_at: zonedToUtc(v.date, v.start, tz).toISOString(),
    p_ends_at: zonedToUtc(v.date, v.end, tz).toISOString(),
    p_reason: v.reason,
  });
  if (error) return formDbError(error);
  revalidatePath('/admin/bookings');
  return formSuccess('Đã khóa sân trong khung giờ này.');
}
