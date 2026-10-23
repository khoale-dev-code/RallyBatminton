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

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Email cảnh báo qua Resend (resend.com > API Keys). Không có → không gửi email, chỉ hiện trong admin. */
export function getAlertEmailConfig(): { apiKey: string | null; from: string; apiBase: string } {
  return {
    apiKey: optionalEnv('RESEND_API_KEY'),
    from: optionalEnv('ALERT_EMAIL_FROM') ?? 'Rally <onboarding@resend.dev>',
    apiBase: optionalEnv('RESEND_API_BASE') ?? 'https://api.resend.com',
  };
}

/** API Token ở SePay > API Access — dùng để đối soát (hỏi danh sách giao dịch gần đây). */
export function getSepayApiConfig(): { token: string | null; apiBase: string } {
  return { token: optionalEnv('SEPAY_API_TOKEN'), apiBase: optionalEnv('SEPAY_API_BASE') ?? 'https://my.sepay.vn' };
}

/** Khóa bảo vệ đường dẫn chạy định kỳ /api/cron/sepay-reconcile (Vercel Cron / Supabase pg_cron). */
export function getCronSecret(): string | null {
  return optionalEnv('CRON_SECRET');
}

/**
 * (Tùy chọn) Chỉ nhận webhook SePay từ các IP này — xem developer.sepay.vn → Địa chỉ IP.
 * Ví dụ: SEPAY_ALLOWED_IPS=103.255.238.9,35.240.192.27. Để trống = không giới hạn (vẫn bắt buộc HMAC / API Key).
 */
export function getSepayAllowedIps(): string[] {
  return (process.env.SEPAY_ALLOWED_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
