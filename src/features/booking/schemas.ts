import { z } from 'zod';

import { zIdempotencyKey, zOptionalText, zText, zUuid, zVnPhone } from '@/lib/validation';

/** Kết quả RPC booking_json (database) — kiểm tra hình dạng thay vì ép kiểu. */
export const bookingSummarySchema = z.object({
  booking_id: z.string(),
  code: z.string(),
  status: z.string(),
  branch_id: z.string(),
  court_id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  total_amount: z.number(),
  deposit_amount: z.number(),
  paid_amount: z.number(),
  hold_expires_at: z.string().nullable(),
  refund_entitlement: z.number().nullable(),
  replayed: z.boolean().optional(),
  branch_name: z.string().optional(),
  branch_address: z.string().optional(),
  court_name: z.string().optional(),
  contact_name: z.string().nullable().optional(),
});

export type BookingSummary = z.infer<typeof bookingSummarySchema>;

/** Một đơn trong danh sách tra cứu bằng số điện thoại (mã che bớt, chỉ tên gọi). */
export const phoneBookingSchema = z.object({
  booking_id: z.string(),
  code_masked: z.string(),
  status: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  branch_name: z.string(),
  branch_address: z.string().nullable(),
  court_name: z.string(),
  total_amount: z.number(),
  paid_amount: z.number(),
  name_hint: z.string().nullable(),
  created_at: z.string(),
});

export type PhoneBooking = z.infer<typeof phoneBookingSchema>;

export const phoneLookupSchema = z.object({
  items: z.array(phoneBookingSchema),
  member_bookings: z.number(),
});

export const guestHoldSchema = z.object({
  courtId: zUuid('sân'),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  contactName: zText('họ tên', 2, 80),
  phone: zVnPhone(),
  note: zOptionalText(300),
  turnstileToken: z.string().min(1, 'Vui lòng hoàn tất bước xác minh chống spam'),
  idempotencyKey: zIdempotencyKey(),
});

export type GuestHoldInput = z.input<typeof guestHoldSchema>;

export type GuestHoldResult =
  | { ok: true; booking: BookingSummary; savedToAccount: boolean }
  | { ok: false; error: string; code?: string; fieldErrors?: Partial<Record<string, string>> };
