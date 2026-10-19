/**
 * Biến môi trường an toàn cho cả server và trình duyệt.
 * Biến NEXT_PUBLIC_* phải được đọc tĩnh (process.env.NEXT_PUBLIC_X) để Next.js nhúng vào bundle.
 */
export const publicEnv = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseKey.length > 0;
}

export class ConfigurationError extends Error {
  constructor(message = 'SUPABASE_NOT_CONFIGURED') {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function requireSupabaseConfig(): { url: string; key: string } {
  if (!isSupabaseConfigured()) throw new ConfigurationError();
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabaseKey };
}
