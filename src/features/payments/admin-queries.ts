import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { todayKey, zonedToUtc } from '@/lib/time';

export const BANK_FILTERS = ['pending', 'matched', 'ignored', 'all'] as const;
export type BankFilter = (typeof BANK_FILTERS)[number];
export const BANK_PAGE_SIZE = 40;

/** Giao dịch ngân hàng (RLS: chủ sân mọi giao dịch; nhân viên thu tiền: chi nhánh mình + giao dịch chưa khớp). */
export async function listBankTransactions(filter: BankFilter, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from('bank_transactions')
    .select(
      'id, gateway, account_number, amount, content, payment_code, reference_code, transaction_at, status, status_note, booking_id, resolved_at, bookings(code, contact_name, status), branches(name)',
      { count: 'exact' },
    )
    .eq('transfer_type', 'in')
    .order('transaction_at', { ascending: false })
    .range((page - 1) * BANK_PAGE_SIZE, page * BANK_PAGE_SIZE - 1);
  if (filter === 'pending') query = query.in('status', ['unmatched', 'review']);
  else if (filter !== 'all') query = query.eq('status', filter);

  const dayStart = zonedToUtc(todayKey(), '00:00').toISOString();
  const [list, today, pending] = await Promise.all([
    query,
    supabase.from('bank_transactions').select('amount, status').eq('transfer_type', 'in').gte('transaction_at', dayStart),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).in('status', ['unmatched', 'review']),
  ]);
  const todayRows = today.data ?? [];
  return {
    rows: list.data ?? [],
    total: list.count ?? 0,
    summary: {
      todayCount: todayRows.length,
      todayAmount: todayRows.reduce((n, r) => n + r.amount, 0),
      todayAuto: todayRows.filter((r) => r.status === 'matched').length,
      pending: pending.count ?? 0,
    },
  };
}

export type BankTransactionRow = Awaited<ReturnType<typeof listBankTransactions>>['rows'][number];

/** Lần đối soát SePay gần nhất (chỉ chủ sân đọc được — RLS). Bảng chưa có (chưa chạy SQL 16) → null. */
export async function getLastReconcileRun() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reconcile_runs')
    .select('source, started_at, finished_at, fetched, new_count, error')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return error ? null : data;
}

export type ReconcileRun = NonNullable<Awaited<ReturnType<typeof getLastReconcileRun>>>;
