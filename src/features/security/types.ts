import { z } from 'zod';

import { type Database } from '@/lib/supabase/database.types';

export type SecuritySettings = Database['public']['Tables']['security_settings']['Row'];

export const onlineBookingStatusSchema = z.object({ paused: z.boolean(), message: z.string().nullable() });
export type OnlineBookingStatus = z.infer<typeof onlineBookingStatusSchema>;

export const HOLD_LEVELS = ['trusted', 'normal', 'elevated', 'blocked'] as const;
export type HoldLevel = (typeof HOLD_LEVELS)[number];

export const holdStatusSchema = z.object({
  level: z.enum(HOLD_LEVELS),
  reason: z.enum(['manual', 'abandoned']).nullable(),
  abandoned: z.number(),
  until: z.string().nullish(),
  note: z.string().nullish(),
  window_days: z.number(),
  elevated_after: z.number(),
  block_after: z.number(),
  can_edit: z.boolean(),
});
export type HoldStatus = z.infer<typeof holdStatusSchema>;

export const restrictedCustomerSchema = z.object({
  customer_id: z.string(),
  name: z.string(),
  phone: z.string(),
  level: z.enum(HOLD_LEVELS),
  reason: z.enum(['manual', 'abandoned']).nullable(),
  abandoned: z.number(),
  until: z.string().nullish(),
  note: z.string().nullish(),
});
export type RestrictedCustomer = z.infer<typeof restrictedCustomerSchema>;

export interface StaffMfaRow {
  userId: string;
  role: 'owner' | 'staff';
  displayName: string;
  isActive: boolean;
  enrolled: boolean;
  enrolledAt: string | null;
}

export const HOLD_LEVEL_INFO: Record<HoldLevel, { label: string; tone: 'green' | 'neutral' | 'amber' | 'red'; hint: string }> = {
  trusted: { label: 'Tin cậy', tone: 'green', hint: 'Không áp giới hạn tự động.' },
  normal: { label: 'Bình thường', tone: 'neutral', hint: 'Giữ sân online như mọi khách.' },
  elevated: { label: 'Giới hạn', tone: 'amber', hint: 'Chỉ giữ 1 lượt mỗi lúc, thời gian giữ ngắn hơn.' },
  blocked: { label: 'Tạm chặn giữ online', tone: 'red', hint: 'Không giữ online được; vẫn đặt tại quầy / qua điện thoại.' },
};
