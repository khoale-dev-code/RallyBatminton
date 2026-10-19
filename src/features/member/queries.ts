import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';

import { hasSessionCookie } from '@/lib/auth/session-cookie';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

import { memberBookingSchema, memberProfileSchema, type MemberBooking, type MemberProfile } from './schemas';

/** Hồ sơ thành viên của người đang đăng nhập (null = khách vãng lai hoặc tài khoản nhân sự). */
export const getMemberProfile = cache(async (): Promise<MemberProfile | null> => {
  // Gọi thẳng RPC (JWT trong cookie được PostgREST xác minh) — bỏ 1 lượt getClaims qua mạng.
  if (!isSupabaseConfigured() || !(await hasSessionCookie())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_member_profile');
  if (error || data === null) return null;
  const parsed = memberProfileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

/** Trang tài khoản: bắt buộc là thành viên đang hoạt động. */
export async function requireMember(options: { allowPasswordChange?: boolean; next?: string } = {}): Promise<MemberProfile> {
  const profile = await getMemberProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(options.next ?? '/account')}`);
  if (profile.is_locked) redirect('/login?error=locked');
  if (profile.must_change_password && !options.allowPasswordChange) redirect('/account/profile?doi-mat-khau=1');
  return profile;
}

export const listMyBookings = cache(async (): Promise<MemberBooking[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_member_bookings', { p_limit: 200 });
  if (error) return [];
  const parsed = z.array(memberBookingSchema).safeParse(data);
  return parsed.success ? parsed.data : [];
});

export async function getMyBooking(code: string): Promise<MemberBooking | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_member_booking', { p_code: code });
  if (error) return null;
  const parsed = memberBookingSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export interface PointEntry {
  id: number;
  kind: string;
  delta: number;
  reason: string;
  createdAt: string;
}

/**
 * Sổ điểm của người đang đăng nhập. RLS chỉ trả dòng của chính họ (thành viên không có quyền xem
 * của người khác), nên có thể gọi song song với requireMember(); userId dùng để lọc lại cho chắc.
 */
export async function listMyPoints(userId: Promise<string> | string, limit = 20): Promise<PointEntry[]> {
  const supabase = await createClient();
  const [{ data }, uid] = await Promise.all([
    supabase
      .from('member_point_ledger')
      .select('id, user_id, kind, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    userId,
  ]);
  return (data ?? [])
    .filter((r) => r.user_id === uid)
    .map((r) => ({ id: r.id, kind: r.kind, delta: r.delta, reason: r.reason, createdAt: r.created_at }));
}
