import 'server-only';

import { createClient } from '@/lib/supabase/server';

import { type PushPrefs } from './lib/push';

export interface PushDevice {
  id: string;
  label: string | null;
  createdAt: string;
  lastSentAt: string | null;
  disabled: boolean;
  lastError: string | null;
}

/** Loại thông báo đã chọn + thiết bị đã bật của người đang đăng nhập. null = chưa chạy 24_push_notifications.sql. */
export async function getMyPushState(): Promise<{ prefs: PushPrefs; devices: PushDevice[] } | null> {
  const supabase = await createClient();
  const [prefs, devices] = await Promise.all([
    supabase.from('push_preferences').select('booking_new, deposit_paid, payment_review, security').maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('id, device_label, created_at, last_sent_at, disabled_at, last_error')
      .order('created_at', { ascending: false }),
  ]);
  if (prefs.error || devices.error) return null;
  return {
    prefs: prefs.data ?? { booking_new: true, deposit_paid: true, payment_review: true, security: true },
    devices: devices.data.map((d) => ({
      id: d.id,
      label: d.device_label,
      createdAt: d.created_at,
      lastSentAt: d.last_sent_at,
      disabled: d.disabled_at !== null,
      lastError: d.last_error,
    })),
  };
}
