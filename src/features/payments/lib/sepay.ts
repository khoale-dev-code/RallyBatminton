import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Sai lệch đồng hồ tối đa cho chữ ký HMAC (giây). */
export const SEPAY_TIMESTAMP_TOLERANCE = 300;

export type SepayAuthResult = 'ok' | 'unauthorized' | 'not_configured';

interface VerifyInput {
  rawBody: string;
  authorization: string | null;
  signature: string | null;
  timestamp: string | null;
  secret: string | null;
  apiKey: string | null;
  nowSeconds: number;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Xác thực yêu cầu webhook SePay.
 *  - HMAC-SHA256: X-SePay-Signature = "sha256=" + hex(HMAC(secret, `${timestamp}.${rawBody}`)), lệch giờ ≤ 5 phút.
 *  - API Key: Authorization = "Apikey <key>".
 * Cấu hình cách nào thì chấp nhận cách đó; không cấu hình gì → từ chối.
 */
export function verifySepayRequest(input: VerifyInput): SepayAuthResult {
  if (!input.secret && !input.apiKey) return 'not_configured';

  if (input.secret && input.signature && input.timestamp && /^\d{9,12}$/.test(input.timestamp)) {
    const ts = Number(input.timestamp);
    if (Math.abs(input.nowSeconds - ts) <= SEPAY_TIMESTAMP_TOLERANCE) {
      const expected = `sha256=${createHmac('sha256', input.secret).update(`${input.timestamp}.${input.rawBody}`).digest('hex')}`;
      if (safeEqual(expected, input.signature.trim())) return 'ok';
    }
  }

  if (input.apiKey && input.authorization) {
    const match = /^Apikey\s+(.+)$/i.exec(input.authorization.trim());
    if (match?.[1] && safeEqual(match[1].trim(), input.apiKey)) return 'ok';
  }
  return 'unauthorized';
}
