import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { createPublicClient } from '@/lib/supabase/public';
import { createSecretClient } from '@/lib/supabase/secret';
import { createClient } from '@/lib/supabase/server';

import { securityEventSchema, type SecurityEventItem } from './lib/events';
import {
  holdStatusSchema,
  onlineBookingStatusSchema,
  restrictedCustomerSchema,
  type HoldStatus,
  type OnlineBookingStatus,
  type RestrictedCustomer,
  type SecuritySettings,
  type StaffMfaRow,
} from './types';

export type { HoldStatus, OnlineBookingStatus, RestrictedCustomer, SecuritySettings, StaffMfaRow } from './types';

const OPEN: OnlineBookingStatus = { paused: false, message: null };

const fetchOnlineBookingStatus = unstable_cache(
  async (): Promise<OnlineBookingStatus> => {
    const { data, error } = await createPublicClient().rpc('online_booking_status');
    if (error) {
      // Chưa chạy 23_security_hardening.sql → coi như đang mở (không chặn khách).
      if (error.code === 'PGRST202') return OPEN;
      throw new Error(error.message);
    }
    const parsed = onlineBookingStatusSchema.safeParse(data);
    return parsed.success ? parsed.data : OPEN;
  },
  ['online-booking-status', 'v1'],
  { tags: [PUBLIC_TAGS.booking], revalidate: PUBLIC_REVALIDATE.booking },
);

/** Đặt sân online đang mở hay chủ sân tạm dừng (trang khách). Lỗi mạng → coi như mở; database vẫn chặn khi giữ sân. */
export async function getOnlineBookingStatus(): Promise<OnlineBookingStatus> {
  if (!isSupabaseConfigured()) return OPEN;
  try {
    return await fetchOnlineBookingStatus();
  } catch {
    return OPEN;
  }
}

/** Cài đặt bảo mật (chủ sân; RLS). null = chưa chạy SQL 23 hoặc không có quyền. */
export async function getSecuritySettings(): Promise<SecuritySettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('security_settings').select('*').eq('id', true).maybeSingle();
  if (error || !data) return null;
  return data;
}

export type SecurityEventRow = SecurityEventItem & { acknowledged_at: string | null };

export async function listSecurityEvents(limit = 60): Promise<SecurityEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_events')
    .select('id, kind, severity, subject, occurrences, first_seen_at, last_seen_at, acknowledged_at, branches(name)')
    .order('last_seen_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.flatMap((row) => {
    const parsed = securityEventSchema
      .extend({ acknowledged_at: z.string().nullable() })
      .safeParse({ ...row, branch_name: row.branches?.name ?? null });
    return parsed.success ? [parsed.data] : [];
  });
}

/** Số sự kiện "Cần chú ý" / "Nghiêm trọng" chưa xử lý (huy hiệu menu). */
export async function countOpenSecurityEvents(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .is('acknowledged_at', null)
    .in('severity', ['warning', 'critical']);
  return error ? 0 : (count ?? 0);
}

export async function listRestrictedCustomers(): Promise<RestrictedCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('restricted_customers');
  if (error) return [];
  const parsed = z.array(restrictedCustomerSchema).safeParse(data);
  return parsed.success ? parsed.data : [];
}

export async function getCustomerHoldStatus(customerId: string): Promise<HoldStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('customer_hold_status', { p_customer_id: customerId });
  if (error) return null;
  const parsed = holdStatusSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Tài khoản quản trị + trạng thái xác thực 2 lớp (chỉ chủ sân gọi — trang đã kiểm tra quyền).
 * Danh sách tài khoản đọc theo quyền của chủ sân (RLS); trạng thái 2 lớp đọc bằng khóa máy chủ.
 */
export async function listStaffMfa(): Promise<StaffMfaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_accounts')
    .select('user_id, role, display_name, is_active')
    .order('role')
    .order('display_name');
  if (error || !data) return [];
  const admin = createSecretClient();
  return Promise.all(
    data.map(async (a) => {
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: a.user_id });
      const verified = (factors?.factors ?? []).filter((f) => f.status === 'verified');
      return {
        userId: a.user_id,
        role: a.role,
        displayName: a.display_name,
        isActive: a.is_active,
        enrolled: verified.length > 0,
        enrolledAt: verified[0]?.created_at ?? null,
      };
    }),
  );
}
