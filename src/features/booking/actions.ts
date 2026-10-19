'use server';

import { createHash } from 'node:crypto';

import { headers } from 'next/headers';
import { z } from 'zod';

import { getAuthUserId } from '@/lib/auth/context';
import { errorCode, toUserMessage } from '@/lib/errors';
import { formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createSecretClient } from '@/lib/supabase/secret';
import { zText, zUuid, zVnPhone } from '@/lib/validation';

import {
  bookingSummarySchema,
  guestHoldSchema,
  phoneLookupSchema,
  type BookingSummary,
  type GuestHoldInput,
  type GuestHoldResult,
  type PhoneBooking,
} from './schemas';
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

// ---- Khách vãng lai quên mã: tra bằng số điện thoại ------------------------------------------

/** Dấu vết thiết bị để giới hạn số lần thử (băm IP, không lưu IP thật). */
async function clientKey(): Promise<string | undefined> {
  const h = await headers();
  const ip = h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip) return undefined;
  return createHash('sha256').update(`rally-lookup:${ip}`).digest('hex').slice(0, 40);
}

const phoneOnlySchema = z.object({ phone: zVnPhone(), turnstileToken: z.string().min(1, 'Vui lòng hoàn tất bước xác minh') });

export interface PhoneLookupState extends FormState {
  phone?: string;
  items?: PhoneBooking[];
  memberBookings?: number;
}

/** Bước 1: danh sách đơn của số điện thoại (chỉ xem — mã che bớt, chỉ hiện tên gọi). */
export async function lookupByPhoneAction(_prev: PhoneLookupState, formData: FormData): Promise<PhoneLookupState> {
  const parsed = phoneOnlySchema.safeParse({ phone: formData.get('phone'), turnstileToken: formData.get('turnstileToken') });
  if (!parsed.success) return formZodError(parsed.error);
  if (!(await verifyTurnstile(parsed.data.turnstileToken))) {
    return formError('Xác minh chống spam không thành công. Vui lòng thử lại.', { turnstileToken: 'Hãy xác minh lại' });
  }
  const { data, error } = await createSecretClient().rpc('lookup_guest_bookings_by_phone', {
    p_phone: parsed.data.phone,
    p_client: await clientKey(),
  });
  if (error) return formError(toUserMessage(error));
  const result = phoneLookupSchema.safeParse(data);
  if (!result.success) return formError('Không đọc được danh sách đơn.');
  return { ...formSuccess(''), phone: parsed.data.phone, items: result.data.items, memberBookings: result.data.member_bookings };
}

const revealSchema = z.object({
  bookingId: zUuid('đơn'),
  phone: zVnPhone(),
  name: zText('họ tên người đặt', 2, 80).transform((v) => v.normalize('NFC')),
});

export interface RevealState extends LookupState {
  bookingId?: string;
}

/** Bước 2: nhập đúng họ tên đã dùng khi đặt → mở đủ thông tin đơn (mã đầy đủ, hủy đơn). */
export async function revealGuestBookingAction(_prev: RevealState, formData: FormData): Promise<RevealState> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const parsed = revealSchema.safeParse({ bookingId, phone: formData.get('phone'), name: formData.get('name') });
  if (!parsed.success) return { ...formZodError(parsed.error), bookingId };
  const { data, error } = await createSecretClient().rpc('reveal_guest_booking', {
    p_booking_id: parsed.data.bookingId,
    p_phone: parsed.data.phone,
    p_name: parsed.data.name,
    p_client: await clientKey(),
  });
  if (error) return { ...formError(toUserMessage(error)), bookingId };
  const mismatch = z.object({ error: z.string() }).safeParse(data);
  if (mismatch.success) return { ...formError(toUserMessage({ message: mismatch.data.error }), { name: 'Họ tên chưa khớp' }), bookingId };
  const booking = bookingSummarySchema.safeParse(data);
  if (!booking.success) return { ...formError('Không đọc được thông tin đơn.'), bookingId };
  return { ...formSuccess(''), booking: booking.data, phone: parsed.data.phone, bookingId };
}

/** Kiểm tra lại đơn (trang chờ chuyển khoản tự hỏi vài giây một lần để biết đã nhận cọc chưa). */
export async function refreshGuestBookingAction(code: string, phone: string): Promise<BookingSummary | null> {
  const parsed = lookupSchema.safeParse({ code, phone });
  if (!parsed.success) return null;
  const { data, error } = await createSecretClient().rpc('lookup_guest_booking', {
    p_code: parsed.data.code,
    p_phone: parsed.data.phone,
  });
  if (error) return null;
  const booking = bookingSummarySchema.safeParse(data);
  return booking.success ? booking.data : null;
}
