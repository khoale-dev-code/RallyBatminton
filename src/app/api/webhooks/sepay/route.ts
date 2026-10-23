import { createHash } from 'node:crypto';

import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendPendingAlertsSafely } from '@/features/payments/alerts';
import { sendSecurityAlertsSafely } from '@/features/security/alerts';
import { isAllowedIp, verifySepayRequestDetailed } from '@/features/payments/lib/sepay';
import { errorCode } from '@/lib/errors';
import { getSepayAllowedIps, getSepayWebhookAuth } from '@/lib/env.server';
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

interface WebhookLog {
  authResult: 'ok' | 'unauthorized' | 'not_configured';
  authMethod: 'hmac' | 'apikey' | null;
  txnId: string | null;
  httpStatus: number;
  outcome: string | null;
  bodySha256: string | null;
  payload: Json | null;
  ipHash: string | null;
}

/** Ghi nhật ký mỗi lần gọi (kể cả bị từ chối) SAU khi đã trả lời SePay — không làm chậm webhook. */
function logEvent(entry: WebhookLog) {
  after(async () => {
    const { error } = await createSecretClient().rpc('service_log_webhook_event', {
      p_provider: 'sepay',
      p_auth_result: entry.authResult,
      p_auth_method: entry.authMethod,
      p_txn_id: entry.txnId,
      p_http_status: entry.httpStatus,
      p_outcome: entry.outcome,
      p_body_sha256: entry.bodySha256,
      p_payload: entry.payload,
      p_ip_hash: entry.ipHash,
    });
    if (error) console.error('[sepay] Chưa ghi được nhật ký webhook (đã chạy 22_privacy_security.sql?):', error.message);
    // Bị từ chối dồn dập → database tạo sự kiện an ninh (23_security_hardening.sql); gửi email cho chủ sân.
    else if (entry.authResult === 'unauthorized') await sendSecurityAlertsSafely();
  });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipHash = ip ? createHash('sha256').update(`rally-webhook:${ip}`).digest('hex').slice(0, 40) : null;
  const base = { txnId: null, outcome: null, bodySha256: null, payload: null, ipHash };

  // Tùy chọn: chỉ nhận từ IP của SePay (SEPAY_ALLOWED_IPS).
  if (!isAllowedIp(ip, getSepayAllowedIps())) {
    console.error(`[sepay] Từ chối IP ngoài danh sách cho phép: ${ip ?? 'không rõ'}`);
    logEvent({ ...base, authResult: 'unauthorized', authMethod: null, httpStatus: 403, outcome: 'ip_not_allowed' });
    return reply(403, false, 'forbidden');
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return reply(413, false, 'payload too large');
  const bodySha256 = createHash('sha256').update(rawBody).digest('hex');

  const verified = verifySepayRequestDetailed({
    rawBody,
    authorization: request.headers.get('authorization'),
    signature: request.headers.get('x-sepay-signature'),
    timestamp: request.headers.get('x-sepay-timestamp'),
    ...getSepayWebhookAuth(),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  const auth = verified.result;
  if (auth === 'not_configured') {
    console.error('[sepay] Chưa cấu hình SEPAY_WEBHOOK_SECRET hoặc SEPAY_WEBHOOK_API_KEY — từ chối webhook.');
    logEvent({ ...base, bodySha256, authResult: auth, authMethod: null, httpStatus: 503, outcome: 'not_configured' });
    return reply(503, false, 'webhook not configured');
  }
  if (auth !== 'ok') {
    logEvent({ ...base, bodySha256, authResult: auth, authMethod: null, httpStatus: 401, outcome: 'unauthorized' });
    // Ghi lý do (không ghi khóa) để xem trong Vercel → Logs khi SePay báo lỗi 401.
    console.error(
      `[sepay] Sai xác thực: có chữ ký=${Boolean(request.headers.get('x-sepay-signature'))}, có Authorization=${Boolean(request.headers.get('authorization'))}`,
    );
    return reply(401, false, 'unauthorized');
  }

  const okLog = { ...base, bodySha256, authResult: auth, authMethod: verified.method };
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    logEvent({ ...okLog, httpStatus: 400, outcome: 'invalid_json' });
    return reply(400, false, 'invalid json');
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[sepay] Dữ liệu không đúng dạng:', parsed.error.issues.map((i) => i.path.join('.')).join(', '));
    logEvent({ ...okLog, httpStatus: 400, outcome: 'invalid_payload', payload: toJson(body) });
    return reply(400, false, 'invalid payload');
  }
  const txnId = String(parsed.data.id);
  const payload = toJson(parsed.data);

  // Chống ghi lặp: bank_transactions có ràng buộc duy nhất (provider, provider_txn_id) — SePay gửi lại cũng chỉ ghi một lần.
  const { data, error } = await createSecretClient().rpc('record_sepay_transaction', { p_payload: payload });
  if (error) {
    // Dữ liệu sai thì không cần SePay gửi lại; lỗi khác (mất kết nối database…) trả 500 để SePay thử lại.
    if (errorCode(error) === 'INVALID_WEBHOOK_PAYLOAD') {
      logEvent({ ...okLog, txnId, payload, httpStatus: 400, outcome: 'invalid_payload' });
      return reply(400, false, 'invalid payload');
    }
    console.error('[sepay] Ghi giao dịch lỗi:', error.message);
    logEvent({ ...okLog, txnId, payload, httpStatus: 500, outcome: 'db_error' });
    return reply(500, false, 'temporary error');
  }
  // Giao dịch không khớp đơn vẫn trả thành công: đã lưu vào "Giao dịch ngân hàng" để nhân viên gán tay,
  // đồng thời email cho chủ sân (chạy sau khi đã trả lời SePay, không làm chậm webhook).
  const outcome = resultSchema.safeParse(data);
  if (outcome.success && outcome.data.replayed !== true && (outcome.data.status === 'review' || outcome.data.status === 'unmatched')) {
    after(sendPendingAlertsSafely);
  }
  logEvent({
    ...okLog,
    txnId,
    payload,
    httpStatus: 200,
    outcome: outcome.success ? (outcome.data.replayed === true ? 'replayed' : (outcome.data.status ?? 'ok')) : 'ok',
  });
  return reply(200, true);
}
