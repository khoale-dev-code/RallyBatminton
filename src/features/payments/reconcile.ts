import 'server-only';

import { z } from 'zod';

import { getSepayApiConfig } from '@/lib/env.server';
import { createSecretClient } from '@/lib/supabase/secret';
import { type Json } from '@/lib/supabase/database.types';

import { dispatchPushSafely } from '@/features/push/send';

import { sendPendingAlertsSafely } from './alerts';
import { apiTransactionToPayload, sepayApiListSchema, sepayApiTransactionSchema, sepayDateTime } from './lib/sepay-api';

export type ReconcileSource = 'cron' | 'manual' | 'vercel';
export type ReconcileResult = { ok: true; accounts: number; fetched: number; created: number } | { ok: false; message: string };

const startSchema = z.object({ run_id: z.string(), since: z.string() });
const recordSchema = z.looseObject({ replayed: z.boolean().optional() });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** SePay giới hạn 2 yêu cầu/giây: giãn cách và thử lại một lần khi bị 429. */
async function fetchTransactions(apiBase: string, token: string, account: string, since: Date): Promise<unknown[]> {
  const url = new URL('/userapi/transactions/list', apiBase);
  url.searchParams.set('account_number', account);
  url.searchParams.set('transaction_date_min', sepayDateTime(since));
  url.searchParams.set('limit', '500');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get('x-sepay-userapi-retry-after') ?? '1');
      await sleep(Math.min(Math.max(wait, 1), 5) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error('SePay từ chối API Token (sai hoặc đã bị xóa).');
    if (!res.ok) throw new Error(`SePay API trả lỗi ${res.status}.`);
    const body = sepayApiListSchema.safeParse(await res.json());
    if (!body.success) throw new Error('SePay API trả dữ liệu không đúng dạng.');
    return body.data.transactions;
  }
  throw new Error('SePay API đang giới hạn tần suất, thử lại sau.');
}

/**
 * Đối soát dự phòng: hỏi SePay giao dịch gần đây của mọi tài khoản nhận cọc, ghi bù giao dịch webhook bị lọt.
 * Ghi trùng là vô hại (record_sepay_transaction bỏ qua giao dịch đã có), nên chạy bao nhiêu lần cũng được.
 */
export async function runSepayReconcile(source: ReconcileSource): Promise<ReconcileResult> {
  const { token, apiBase } = getSepayApiConfig();
  if (!token) return { ok: false, message: 'Chưa cấu hình SEPAY_API_TOKEN (SePay > API Access).' };

  const supabase = createSecretClient();
  const started = await supabase.rpc('service_reconcile_start', { p_source: source });
  const run = startSchema.safeParse(started.data);
  if (started.error || !run.success) {
    return { ok: false, message: 'Chưa chạy 16_alerts_reconcile.sql trên Supabase.' };
  }
  const finish = (fetched: number, created: number, error: string | null) =>
    supabase.rpc('service_reconcile_finish', { p_run_id: run.data.run_id, p_fetched: fetched, p_new: created, p_error: error });

  const accounts = await supabase.rpc('service_bank_accounts');
  const list = Array.isArray(accounts.data) ? accounts.data.filter((a): a is string => typeof a === 'string' && a.length > 0) : [];
  if (list.length === 0) {
    await finish(0, 0, 'Chưa có số tài khoản nhận cọc.');
    return { ok: false, message: 'Chưa khai báo số tài khoản nhận cọc ở Cài đặt.' };
  }

  let fetched = 0;
  let created = 0;
  try {
    for (const [index, account] of list.entries()) {
      if (index > 0) await sleep(600);
      const rows = await fetchTransactions(apiBase, token, account, new Date(run.data.since));
      for (const raw of rows) {
        const parsed = sepayApiTransactionSchema.safeParse(raw);
        if (!parsed.success) continue;
        const payload = apiTransactionToPayload(parsed.data);
        if (!payload) continue;
        fetched += 1;
        const recorded = await supabase.rpc('record_sepay_transaction', { p_payload: payload satisfies Json });
        if (recorded.error) throw new Error(`Ghi giao dịch ${String(payload.id)} lỗi: ${recorded.error.message}`);
        const result = recordSchema.safeParse(recorded.data);
        if (result.success && result.data.replayed !== true) created += 1;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định.';
    console.error('[reconcile]', message);
    await finish(fetched, created, message);
    if (created > 0) await sendPendingAlertsSafely();
    return { ok: false, message };
  }

  await finish(fetched, created, null);
  if (created > 0) console.warn(`[reconcile] Ghi bù ${created} giao dịch webhook bị lọt.`);
  await sendPendingAlertsSafely();
  if (created > 0) await dispatchPushSafely();
  return { ok: true, accounts: list.length, fetched, created };
}
