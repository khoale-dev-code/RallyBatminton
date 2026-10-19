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
