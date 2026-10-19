'use client';

import { useSyncExternalStore } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';

import { memberProfileSchema, type MemberProfile } from '../schemas';

export type MemberState = { status: 'loading' } | { status: 'guest' } | { status: 'member'; profile: MemberProfile };

const LOADING: MemberState = { status: 'loading' };
const GUEST: MemberState = { status: 'guest' };

let snapshot: MemberState = LOADING;
let started = false;
let loadSeq = 0;
const listeners = new Set<() => void>();

function emit(next: MemberState) {
  snapshot = next;
  for (const l of listeners) l();
}

/** Đọc lại phiên đăng nhập (cookie) + hồ sơ thành viên. Tài khoản nhân sự được coi như khách. */
export async function refreshMember(): Promise<void> {
  if (!isSupabaseConfigured()) {
    emit(GUEST);
    return;
  }
  const seq = ++loadSeq;
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    if (seq === loadSeq) emit(GUEST);
    return;
  }
  const { data: profile, error } = await supabase.rpc('my_member_profile');
  if (seq !== loadSeq) return;
  const parsed = error ? null : memberProfileSchema.safeParse(profile);
  emit(parsed?.success ? { status: 'member', profile: parsed.data } : GUEST);
}

function start() {
  if (started) return;
  started = true;
  void refreshMember();
  if (isSupabaseConfigured()) {
    getBrowserClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void refreshMember();
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/** Trạng thái thành viên phía trình duyệt (trang công khai vẫn được cache tĩnh). */
export function useMember(): MemberState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => LOADING,
  );
}
