import 'server-only';

import { emailConfigured, sendEmail } from '@/lib/email';
import { configuredSiteUrl } from '@/lib/site-origin';
import { createSecretClient } from '@/lib/supabase/secret';

import { pendingSecurityAlertsSchema, securityAlertHtml, securityAlertSubject, securityAlertText } from './lib/events';

/**
 * Gửi chủ sân các sự kiện an ninh "Cần chú ý" / "Nghiêm trọng" chưa báo (gộp một email).
 * Mỗi sự kiện báo một lần; sự kiện lặp lại trong 1 giờ được gộp vào cùng một dòng.
 */
export async function sendSecurityAlerts(): Promise<'sent' | 'nothing' | 'skipped' | 'failed'> {
  const supabase = createSecretClient();
  const { data, error } = await supabase.rpc('service_pending_security_alerts', { p_limit: 20 });
  if (error) {
    if (error.code !== 'PGRST202') console.error('[security-alerts] Không đọc được sự kiện:', error.message);
    return 'failed';
  }
  const parsed = pendingSecurityAlertsSchema.safeParse(data);
  if (!parsed.success || parsed.data.items.length === 0) return 'nothing';
  const { items, recipients } = parsed.data;
  if (!emailConfigured() || recipients.length === 0) return 'skipped';
  const url = `${configuredSiteUrl()}/admin/security`;
  const sent = await sendEmail(recipients, securityAlertSubject(items), securityAlertHtml(items, url), securityAlertText(items, url));
  if (!sent.ok) {
    console.error('[security-alerts] Gửi email lỗi:', sent.message);
    return 'failed';
  }
  await supabase.rpc('service_mark_security_alerted', { p_ids: items.map((i) => i.id) });
  return 'sent';
}

/** Không để lỗi email làm hỏng việc chính. */
export async function sendSecurityAlertsSafely(): Promise<void> {
  try {
    await sendSecurityAlerts();
  } catch (error) {
    console.error('[security-alerts] Lỗi không mong muốn:', error instanceof Error ? error.message : error);
  }
}
