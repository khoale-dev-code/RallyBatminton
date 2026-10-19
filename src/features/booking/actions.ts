'use server';

import { z } from 'zod';

import { getAuthUserId } from '@/lib/auth/context';
import { errorCode, toUserMessage } from '@/lib/errors';
import { formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createSecretClient } from '@/lib/supabase/secret';
import { zText, zVnPhone } from '@/lib/validation';

import { bookingSummarySchema, guestHoldSchema, type BookingSummary, type GuestHoldInput, type GuestHoldResult } from './schemas';
import { verifyTurnstile } from './turnstile';

/** Khách giữ sân không cần đăng nhập. Mọi kiểm tra cuối cùng (trùng giờ, giá, giới hạn) nằm trong database. */
export async function createGuestHoldAction(input: GuestHoldInput): Promise<GuestHoldResult> {
  const parsed = guestHoldSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<string, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form');
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors };
  }
  const v = parsed.data;

  if (!(await verifyTurnstile(v.turnstileToken))) {
    return {
      ok: false,
      error: 'Xác minh chống spam không thành công. Vui lòng thử lại.',
      fieldErrors: { turnstileToken: 'Hãy xác minh lại' },
    };
  }

  const supabase = createSecretClient();
  const { data, error } = await supabase.rpc('create_guest_booking_hold', {
    p_court_id: v.courtId,
    p_starts_at: v.startsAt,
    p_ends_at: v.endsAt,
    p_contact_name: v.contactName,
    p_phone: v.phone,
    p_customer_note: v.note,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error), code: errorCode(error) ?? undefined };
  const booking = bookingSummarySchema.safeParse(data);
  if (!booking.success) return { ok: false, error: 'Không đọc được kết quả giữ sân. Vui lòng tra cứu lại đơn.' };
  // Khách đang đăng nhập tài khoản thành viên: gắn đơn vào tài khoản (người dùng lấy từ phiên phía máy chủ).
  let savedToAccount = false;
  const userId = await getAuthUserId();
  if (userId) {
    const { data: attached } = await supabase.rpc('service_attach_member_booking', {
      p_booking_id: booking.data.booking_id,
      p_user_id: userId,
    });
    savedToAccount = attached === true;
  }
  return { ok: true, booking: booking.data, savedToAccount };
}

const lookupSchema = z.object({
  code: zText('mã đơn', 6, 20).transform((c) => c.toUpperCase().replace(/\s/g, '')),
  phone: zVnPhone(),
});

export interface LookupState extends FormState {
  booking?: BookingSummary;
  phone?: string;
}

export async function lookupBookingAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = lookupSchema.safeParse({ code: formData.get('code'), phone: formData.get('phone') });
  if (!parsed.success) return formZodError(parsed.error);
  const { data, error } = await createSecretClient().rpc('lookup_guest_booking', {
    p_code: parsed.data.code,
    p_phone: parsed.data.phone,
  });
  if (error) return formError(toUserMessage(error));
  const booking = bookingSummarySchema.safeParse(data);
  if (!booking.success) return formError('Không đọc được thông tin đơn.');
  return { ...formSuccess(''), booking: booking.data, phone: parsed.data.phone };
}

export async function cancelGuestBookingAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const parsed = lookupSchema.safeParse({ code: formData.get('code'), phone: formData.get('phone') });
  if (!parsed.success) return formZodError(parsed.error);
  const { data, error } = await createSecretClient().rpc('cancel_guest_booking', {
    p_code: parsed.data.code,
    p_phone: parsed.data.phone,
    p_reason: 'Khách tự hủy trên website',
  });
  if (error) return formError(toUserMessage(error));
  const booking = bookingSummarySchema.safeParse(data);
  if (!booking.success) return formError('Đã hủy đơn, nhưng không đọc được thông tin cập nhật.');
  return { ...formSuccess('Đã hủy đơn.'), booking: booking.data, phone: parsed.data.phone };
}
