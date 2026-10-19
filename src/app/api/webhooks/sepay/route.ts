import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendPendingAlertsSafely } from '@/features/payments/alerts';
import { verifySepayRequest } from '@/features/payments/lib/sepay';
import { errorCode } from '@/lib/errors';
import { getSepayWebhookAuth } from '@/lib/env.server';
import { createSecretClient } from '@/lib/supabase/secret';
import { type Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dữ liệu SePay gửi (chỉ kiểm tra các trường cần; phần còn lại lưu nguyên vào bank_transactions.raw). */
const numeric = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v), z.number().nonnegative().max(max));

const payloadSchema = z.looseObject({
  id: z.union([
    z.number().int().nonnegative(),
    z
      .string()
      .trim()
      .regex(/^\d{1,30}$/),
  ]),
  transferType: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(['in', 'out'])),
  transferAmount: numeric(10_000_000_000),
  content: z.string().max(1000).nullish(),
  code: z.string().max(100).nullish(),
});

const resultSchema = z.looseObject({ status: z.string().optional(), replayed: z.boolean().optional() });

const MAX_BODY = 32 * 1024;

/** SePay chỉ coi là thành công khi trả HTTP 200/201 với đúng {"success": true} trong 30 giây. */
function reply(status: number, success: boolean, message?: string) {
  return NextResponse.json(success ? { success: true } : { success: false, message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Chuyển JSON đã kiểm tra sang kiểu Json của Supabase mà không ép kiểu. */
function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object') {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = toJson(v);
    return out;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return reply(413, false, 'payload too large');

  const auth = verifySepayRequest({
    rawBody,
    authorization: request.headers.get('authorization'),
    signature: request.headers.get('x-sepay-signature'),
    timestamp: request.headers.get('x-sepay-timestamp'),
    ...getSepayWebhookAuth(),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (auth === 'not_configured') {
    console.error('[sepay] Chưa cấu hình SEPAY_WEBHOOK_SECRET hoặc SEPAY_WEBHOOK_API_KEY — từ chối webhook.');
    return reply(503, false, 'webhook not configured');
  }
  if (auth !== 'ok') {
    // Ghi lý do (không ghi khóa) để xem trong Vercel → Logs khi SePay báo lỗi 401.
    console.error(
      `[sepay] Sai xác thực: có chữ ký=${Boolean(request.headers.get('x-sepay-signature'))}, có Authorization=${Boolean(request.headers.get('authorization'))}`,
    );
    return reply(401, false, 'unauthorized');
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return reply(400, false, 'invalid json');
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[sepay] Dữ liệu không đúng dạng:', parsed.error.issues.map((i) => i.path.join('.')).join(', '));
    return reply(400, false, 'invalid payload');
  }

  const { data, error } = await createSecretClient().rpc('record_sepay_transaction', {
    p_payload: toJson(parsed.data),
  });
  if (error) {
    // Dữ liệu sai thì không cần SePay gửi lại; lỗi khác (mất kết nối database…) trả 500 để SePay thử lại.
    if (errorCode(error) === 'INVALID_WEBHOOK_PAYLOAD') return reply(400, false, 'invalid payload');
    console.error('[sepay] Ghi giao dịch lỗi:', error.message);
    return reply(500, false, 'temporary error');
  }
  // Giao dịch không khớp đơn vẫn trả thành công: đã lưu vào "Giao dịch ngân hàng" để nhân viên gán tay,
  // đồng thời email cho chủ sân (chạy sau khi đã trả lời SePay, không làm chậm webhook).
  const outcome = resultSchema.safeParse(data);
  if (outcome.success && outcome.data.replayed !== true && (outcome.data.status === 'review' || outcome.data.status === 'unmatched')) {
    after(sendPendingAlertsSafely);
  }
  return reply(200, true);
}
