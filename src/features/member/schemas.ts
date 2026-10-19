import { z } from 'zod';

import { bookingSummarySchema } from '@/features/booking/schemas';

/** Kết quả private.member_json (database). */
export const memberProfileSchema = z.object({
  user_id: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  login_kind: z.enum(['phone', 'email', 'google']),
  points: z.number(),
  lifetime_points: z.number(),
  tier: z.enum(['member', 'silver', 'gold', 'diamond']),
  is_locked: z.boolean(),
  must_change_password: z.boolean(),
  has_password: z.boolean(),
  marketing_opt_in: z.boolean(),
  created_at: z.string(),
});

export type MemberProfile = z.infer<typeof memberProfileSchema>;

/** Đơn của thành viên = thông tin đơn + chi nhánh + điểm đã cộng. */
export const memberBookingSchema = bookingSummarySchema.extend({
  branch_slug: z.string().optional(),
  contact_phone: z.string().optional(),
  points_earned: z.number().nullable().optional(),
});

export type MemberBooking = z.infer<typeof memberBookingSchema>;

export const MEMBER_ALIAS_DOMAIN = 'thanhvien.rally.invalid';

/** Tài khoản đăng ký bằng SĐT dùng email bí danh (không phải hộp thư thật) để đăng nhập. */
export function memberAliasEmail(localPhone: string): string {
  return `sdt${localPhone}@${MEMBER_ALIAS_DOMAIN}`;
}

export function isMemberAliasEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${MEMBER_ALIAS_DOMAIN}`));
}

/** Chỉ cho phép chuyển hướng nội bộ (chống open redirect). */
export function safeMemberNext(next: string | null | undefined, fallback = '/account'): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && !next.startsWith('/admin')) return next;
  return fallback;
}
