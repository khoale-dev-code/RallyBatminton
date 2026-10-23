import 'server-only';

import { getAlertEmailConfig } from '@/lib/env.server';

export type SendEmailResult = { ok: true } | { ok: false; message: string };

/** Gửi một email qua Resend (gọi thẳng REST, không cần thư viện). Thiếu RESEND_API_KEY → báo lỗi, không ném. */
export async function sendEmail(to: string[], subject: string, html: string, text: string): Promise<SendEmailResult> {
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

/** Đã cấu hình gửi email cảnh báo chưa. */
export function emailConfigured(): boolean {
  return Boolean(getAlertEmailConfig().apiKey);
}
