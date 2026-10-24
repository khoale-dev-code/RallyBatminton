import 'server-only';

import webpush from 'web-push';

import { getPushConfig } from '@/lib/env.server';
import { createSecretClient } from '@/lib/supabase/secret';
import { type Json } from '@/lib/supabase/database.types';

import { isAllowedPushEndpoint, pushItemSchema, pushPayload, pushTtl, pushUrgency, type PushItem } from './lib/push';

type Result = { subscription_id: string; status: number; error?: string };

async function sendOne(
  item: PushItem,
  target: PushItem['targets'][number],
  vapid: NonNullable<ReturnType<typeof getPushConfig>>,
): Promise<Result> {
  if (!isAllowedPushEndpoint(target.endpoint)) return { subscription_id: target.id, status: 410, error: 'endpoint not allowed' };
  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      pushPayload(item),
      {
        TTL: pushTtl(item.kind),
        urgency: pushUrgency(item.kind),
        timeout: 8000,
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      },
    );
    return { subscription_id: target.id, status: res.statusCode };
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 0;
    const message = error instanceof Error ? error.message : 'send failed';
    return { subscription_id: target.id, status, error: message.slice(0, 300) };
  }
}

/**
 * Gửi các thông báo đang chờ trong hàng đợi (24_push_notifications.sql). Chạy sau khi có sự kiện (giữ sân online,
 * webhook SePay, cảnh báo bảo mật), khi Rally Manager thấy lịch sân đổi, và theo lịch hằng đêm.
 * Trả về số thông báo đã gửi thành công. Chưa cấu hình khóa VAPID → không làm gì.
 */
export async function dispatchPendingPush(maxRounds = 3): Promise<number> {
  const vapid = getPushConfig();
  if (!vapid) return 0;
  const supabase = createSecretClient();
  let delivered = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    const { data, error } = await supabase.rpc('service_claim_push', { p_limit: 20 });
    if (error) {
      if (error.code !== 'PGRST202') console.error('[push] Không đọc được hàng đợi:', error.message);
      return delivered;
    }
    const parsed = pushItemSchema.array().safeParse(data);
    if (!parsed.success || parsed.data.length === 0) return delivered;
    for (const item of parsed.data) {
      const results = await Promise.all(item.targets.map((t) => sendOne(item, t, vapid)));
      delivered += results.filter((r) => r.status >= 200 && r.status < 300).length;
      const { error: doneError } = await supabase.rpc('service_push_done', {
        p_outbox_ids: [item.id],
        p_results: results as unknown as Json,
      });
      if (doneError) console.error('[push] Không ghi được kết quả:', doneError.message);
    }
    if (parsed.data.length < 20) break;
  }
  return delivered;
}

/** Không để lỗi gửi thông báo làm hỏng việc chính. */
export async function dispatchPushSafely(): Promise<void> {
  try {
    await dispatchPendingPush();
  } catch (error) {
    console.error('[push] Lỗi không mong muốn:', error instanceof Error ? error.message : error);
  }
}
