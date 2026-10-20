import 'server-only';

import { publicEnv } from '@/lib/env';
import { getAlertEmailConfig } from '@/lib/env.server';
import { createSecretClient } from '@/lib/supabase/secret';

import { alertEmailHtml, alertEmailText, alertSubject, pendingAlertsSchema, type AlertItem } from './lib/alert-email';

export type AlertResult =
  | { status: 'sent'; count: number; recipients: number }
  | { status: 'nothing' }
  | { status: 'skipped'; reason: 'no_api_key' | 'no_recipients' }
  | { status: 'failed'; message: string };

/** Gửi một email qua Resend (gọi thẳng REST, không cần thư viện). */
async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { apiKey, from, apiBase } = getAlertEmailConfig();
  if (!apiKey) return { ok: false, message: 'Chưa cấu hình RESEND_API_KEY.' };
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (res.ok) return { ok: true };
    const body = (await res.text()).slice(0, 300);
    return { ok: false, message: `Resend trả lỗi ${res.status}: ${body}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Không gửi được email.' };
  }
}

const adminBankUrl = () => `${publicEnv.siteUrl}/admin/bank?tab=pending`;

/**
 * Báo chủ sân các giao dịch "Cần xử lý" / "Chưa khớp đơn" chưa báo (gộp một email).
 * Gọi sau webhook, sau mỗi lần đối soát. Gửi thành công mới đánh dấu đã báo — lỗi thì lần sau thử lại.
 */
export async function sendPendingAlerts(): Promise<AlertResult> {
  const supabase = createSecretClient();
  const { data, error } = await supabase.rpc('service_pending_alerts', { p_limit: 20 });
  if (error) {
    console.error('[alerts] Không đọc được giao dịch cần báo (đã chạy 16_alerts_reconcile.sql?):', error.message);
    return { status: 'failed', message: error.message };
  }
  const parsed = pendingAlertsSchema.safeParse(data);
  if (!parsed.success || parsed.data.items.length === 0) return { status: 'nothing' };
  const { items, recipients } = parsed.data;
  if (!getAlertEmailConfig().apiKey) return { status: 'skipped', reason: 'no_api_key' };
  if (recipients.length === 0) return { status: 'skipped', reason: 'no_recipients' };

  const sent = await sendEmail(
    recipients,
    alertSubject(items),
    alertEmailHtml(items, adminBankUrl()),
    alertEmailText(items, adminBankUrl()),
  );
  if (!sent.ok) {
    console.error('[alerts] Gửi email cảnh báo lỗi:', sent.message);
    return { status: 'failed', message: sent.message };
  }
  await supabase.rpc('service_mark_alerted', { p_ids: items.map((i) => i.id) });
  return { status: 'sent', count: items.length, recipients: recipients.length };
}

/** Không để lỗi email làm hỏng việc chính (webhook, đối soát). */
export async function sendPendingAlertsSafely(): Promise<void> {
  try {
    await sendPendingAlerts();
  } catch (error) {
    console.error('[alerts] Lỗi không mong muốn:', error instanceof Error ? error.message : error);
  }
}

const SAMPLE: AlertItem = {
  id: 'test',
  amount: 42000,
  content: 'SEVQR RBEX3BKN9K',
  status: 'review',
  status_note: 'Giữ chỗ đã hết hạn và giờ này đã có người khác đặt — cần liên hệ khách để đổi giờ hoặc hoàn tiền.',
  transaction_at: new Date().toISOString(),
  gateway: null,
  booking_code: 'RB-EX3BKN9K',
  contact_name: 'Nguyễn Văn A',
  contact_phone: '+84900000000',
  starts_at: null,
  court_name: 'Sân A',
  branch_name: 'Chi nhánh mẫu',
};

/** Email thử từ trang Cài đặt — kiểm tra khóa Resend và hộp thư nhận. */
export async function sendTestAlert(): Promise<{ ok: true; recipients: string[] } | { ok: false; message: string }> {
  const { data, error } = await createSecretClient().rpc('service_alert_recipients');
  if (error) return { ok: false, message: 'Chưa chạy 16_alerts_reconcile.sql trên Supabase.' };
  const recipients = Array.isArray(data) ? data.filter((e): e is string => typeof e === 'string') : [];
  if (recipients.length === 0) return { ok: false, message: 'Chưa có email nhận cảnh báo.' };
  const items = [SAMPLE];
  const sent = await sendEmail(
    recipients,
    `[Rally — email thử] ${alertSubject(items).replace('[Rally] ', '')}`,
    alertEmailHtml(items, adminBankUrl()),
    alertEmailText(items, adminBankUrl()),
  );
  return sent.ok ? { ok: true, recipients } : sent;
}
