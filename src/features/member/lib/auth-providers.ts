import 'server-only';

import { z } from 'zod';

import { publicEnv } from '@/lib/env';

const settingsSchema = z.object({ external: z.record(z.string(), z.unknown()) });

export type ProviderStatus = 'enabled' | 'disabled' | 'unknown';

/**
 * Hỏi Supabase Auth xem một cách đăng nhập (google…) đã bật chưa — tránh đưa khách tới trang lỗi JSON
 * "Unsupported provider: provider is not enabled". Hỏi mới mỗi lần bấm để bật/tắt có hiệu lực ngay.
 */
export async function oauthProviderStatus(provider: 'google'): Promise<ProviderStatus> {
  try {
    const res = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publicEnv.supabaseKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 'unknown';
    const parsed = settingsSchema.safeParse(await res.json());
    if (!parsed.success) return 'unknown';
    return parsed.data.external[provider] === true ? 'enabled' : 'disabled';
  } catch {
    return 'unknown';
  }
}
