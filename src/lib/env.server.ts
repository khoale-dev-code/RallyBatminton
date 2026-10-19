import 'server-only';

/** Secret/service-role key: CHỈ dùng trong Server Action / Route Handler. */
export function getSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY chưa được cấu hình trong .env.local');
  return key;
}

export function getTurnstileSecret(): string | null {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  return secret && secret.length > 0 ? secret : null;
}

/**
 * Xác thực webhook SePay (đặt ở SePay > Webhooks > Bảo mật):
 *  - SEPAY_WEBHOOK_SECRET: chọn HMAC-SHA256 (khuyên dùng),
 *  - SEPAY_WEBHOOK_API_KEY: chọn API Key (header "Authorization: Apikey …").
 * Không có cả hai → webhook từ chối mọi yêu cầu.
 */
export function getSepayWebhookAuth(): { secret: string | null; apiKey: string | null } {
  const secret = process.env.SEPAY_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.SEPAY_WEBHOOK_API_KEY?.trim();
  return { secret: secret ? secret : null, apiKey: apiKey ? apiKey : null };
}
