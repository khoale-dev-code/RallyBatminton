import { z } from 'zod';

/** Khách chơi quá giờ dưới mức này (phút) thì không gợi ý tính thêm. */
export const OVERTIME_GRACE_MINUTES = 10;

export const extendOptionsSchema = z.object({
  booking_id: z.string(),
  status: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  slot_minutes: z.number(),
  free_until: z.string(),
  limit_reason: z.enum(['booking', 'closing']),
  next_booking_at: z.string().nullable(),
  can_extend: z.boolean(),
  options: z.array(z.object({ minutes: z.number(), ends_at: z.string(), amount: z.number() })).catch([]),
});
export type ExtendOptions = z.infer<typeof extendOptionsSchema>;
export type ExtendOption = ExtendOptions['options'][number];

/** Số phút khách đã chơi quá giờ kết thúc (0 nếu chưa hết giờ). */
export function overtimeMinutes(endsAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(endsAt).getTime()) / 60000));
}

/**
 * Lựa chọn gợi ý khi khách chơi quá giờ: khung nhỏ nhất phủ tới hiện tại.
 * Quá giờ không quá OVERTIME_GRACE_MINUTES thì không gợi ý (miễn phí vài phút dọn sân).
 */
export function suggestedOption(options: ExtendOption[], endsAt: string, now: number): ExtendOption | null {
  const over = overtimeMinutes(endsAt, now);
  if (over <= OVERTIME_GRACE_MINUTES) return null;
  return options.find((o) => new Date(o.ends_at).getTime() >= now - OVERTIME_GRACE_MINUTES * 60000) ?? options.at(-1) ?? null;
}
