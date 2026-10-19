import 'server-only';

import { headers } from 'next/headers';

import { getTurnstileSecret } from '@/lib/env.server';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/** Xác minh Cloudflare Turnstile ở máy chủ. Production bắt buộc có TURNSTILE_SECRET_KEY. */
export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    console.warn('[turnstile] TURNSTILE_SECRET_KEY chưa cấu hình — bỏ qua xác minh ở môi trường dev.');
    return true;
  }
  const h = await headers();
  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as SiteVerifyResponse;
    return json.success === true;
  } catch {
    return false;
  }
}
