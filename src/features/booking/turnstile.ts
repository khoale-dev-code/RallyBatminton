import 'server-only';

import { headers } from 'next/headers';

import { configuredSiteUrl } from '@/lib/site-origin';
import { getTurnstileSecret } from '@/lib/env.server';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

/** Tên thao tác gắn vào mã xác minh — mỗi form một tên. */
export type TurnstileAction = 'booking_hold' | 'phone_lookup' | 'member_auth' | 'data_request';

function allowedHosts(requestHost: string | null): Set<string> {
  const hosts = new Set<string>();
  const site = configuredSiteUrl();
  if (site) {
    try {
      hosts.add(new URL(site).hostname);
    } catch {
      // URL cấu hình sai: bỏ qua, dùng host của yêu cầu.
    }
  }
  if (requestHost) hosts.add(requestHost.split(':')[0]);
  const vercel = process.env.VERCEL_URL;
  if (vercel) hosts.add(vercel);
  return hosts;
}

/**
 * Xác minh Cloudflare Turnstile ở MÁY CHỦ (Siteverify) — dấu tích trên giao diện không đủ để bảo vệ.
 * Production bắt buộc có TURNSTILE_SECRET_KEY. Kiểm thêm:
 *  - action: mã của form này không dùng lại được cho form khác;
 *  - hostname: mã phải được tạo trên chính website (chống lấy mã từ trang giả mạo dùng chung site key).
 */
export async function verifyTurnstile(token: string, expectedAction?: TurnstileAction): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    console.warn('[turnstile] TURNSTILE_SECRET_KEY chưa cấu hình — bỏ qua xác minh ở môi trường dev.');
    return true;
  }
  if (!token || token.length > 2048) return false;
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
    if (json.success !== true) return false;
    if (expectedAction && json.action && json.action !== expectedAction) {
      console.warn(`[turnstile] Sai thao tác: mong đợi ${expectedAction}, nhận ${json.action}`);
      return false;
    }
    // Khóa thử nghiệm của Cloudflare trả hostname "example.com" — chỉ kiểm hostname ở production.
    if (process.env.NODE_ENV === 'production' && json.hostname) {
      const hosts = allowedHosts(h.get('x-forwarded-host') ?? h.get('host'));
      if (hosts.size > 0 && !hosts.has(json.hostname)) {
        console.warn(`[turnstile] Mã xác minh tạo trên tên miền lạ: ${json.hostname}`);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
