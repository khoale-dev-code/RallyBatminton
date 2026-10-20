import 'server-only';

import { headers } from 'next/headers';

import { publicEnv } from '@/lib/env';

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;

/**
 * Địa chỉ gốc của website theo ĐÚNG tên miền người dùng đang mở (https://rally-eight-tau.vercel.app,
 * tên miền riêng…), dùng cho link / mã QR gửi sang thiết bị khác.
 *
 * Không dựa vào NEXT_PUBLIC_SITE_URL vì biến này hay bị bỏ trống hoặc chép nhầm `http://localhost:3000` lên
 * Vercel → mã QR trỏ về localhost, điện thoại không mở được. Thứ tự: header Origin (server action luôn gửi,
 * Next đã đối chiếu với Host để chống CSRF) → x-forwarded-host/host (Vercel đặt) → biến môi trường.
 */
/**
 * Địa chỉ website khi KHÔNG có request (email cảnh báo, lịch chạy): NEXT_PUBLIC_SITE_URL; nếu biến này trống /
 * là localhost mà đang chạy trên Vercel → tên miền production Vercel tự cấp (VERCEL_PROJECT_PRODUCTION_URL).
 */
export function configuredSiteUrl(): string {
  const env = publicEnv.siteUrl;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (/^https?:\/\/(localhost|127\.)/i.test(env) && vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel.toLowerCase()}`;
  return env;
}

export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin && ORIGIN_RE.test(origin)) return origin.toLowerCase();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]?.trim() ?? '';
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(host);
    const proto = (h.get('x-forwarded-proto') ?? '').split(',')[0]?.trim() || (local ? 'http' : 'https');
    return `${proto === 'http' ? 'http' : 'https'}://${host.toLowerCase()}`;
  }
  return configuredSiteUrl();
}
