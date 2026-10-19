import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';

import { getAuthUserId } from '@/lib/auth/context';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

import { memberBookingSchema, memberProfileSchema, type MemberBooking, type MemberProfile } from './schemas';

/** Hồ sơ thành viên của người đang đăng nhập (null = khách vãng lai hoặc tài khoản nhân sự). */
export const getMemberProfile = cache(async (): Promise<MemberProfile | null> => {
  if (!isSupabaseConfigured()) return null;
  const userId = await getAuthUserId();
  if (!userId) return null;
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

export async function listMyPoints(userId: string, limit = 20): Promise<PointEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('member_point_ledger')
    .select('id, kind, delta, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, kind: r.kind, delta: r.delta, reason: r.reason, createdAt: r.created_at }));
}
