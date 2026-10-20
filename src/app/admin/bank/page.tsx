import { ArrowDownLeft, CircleAlert, Settings2, Zap } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Badge, EmptyState, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { dismissBankTransactionAction, matchBankTransactionAction } from '@/features/payments/actions';
import {
  BANK_FILTERS,
  BANK_PAGE_SIZE,
  getLastReconcileRun,
  listBankTransactions,
  type BankFilter,
  type BankTransactionRow,
} from '@/features/payments/admin-queries';
import { ReconcileBar } from '@/features/payments/components/reconcile-bar';
import { requireStaff, withGuard } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';
import { getSepayApiConfig } from '@/lib/env.server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { type Tone } from '@/lib/labels';

export const metadata = { title: 'Giao dịch ngân hàng' };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  matched: { label: 'Đã ghi vào đơn', tone: 'green' },
  unmatched: { label: 'Chưa khớp đơn', tone: 'amber' },
  review: { label: 'Cần xử lý', tone: 'red' },
  ignored: { label: 'Đã xử lý', tone: 'neutral' },
};

const TAB_LABEL: Record<BankFilter, string> = {
  pending: 'Cần xử lý',
  matched: 'Đã ghi vào đơn',
  ignored: 'Đã bỏ qua',
  all: 'Tất cả',
};

function PendingActions({ row }: { row: BankTransactionRow }) {
  return (
    <div className="grid gap-3 rounded-control bg-hall/60 p-3 md:grid-cols-2">
      {row.status === 'unmatched' && (
        <ActionForm action={matchBankTransactionAction} className="gap-2">
          <input type="hidden" name="txnId" value={row.id} />
          <TextField
            name="code"
            label="Ghi vào đơn"
            placeholder="RB-XXXXXXXX"
            defaultValue={row.payment_code ?? ''}
            className="font-display tracking-wider uppercase"
            hint="Hỏi khách mã đơn (hoặc tra theo SĐT ở Khách hàng)."
          />
          <SubmitButton size="sm" pendingLabel="Đang ghi…">
            Ghi tiền vào đơn
          </SubmitButton>
        </ActionForm>
      )}
      <ActionForm action={dismissBankTransactionAction} className="gap-2">
        <input type="hidden" name="txnId" value={row.id} />
        <TextField
          name="note"
          label="Đã xử lý xong"
          placeholder={row.status === 'review' ? 'Đã gọi khách, hoàn tiền qua CK…' : 'Không phải tiền đặt sân…'}
          hint="Ghi lại cách đã xử lý (hoàn tiền, đổi giờ, thu nhập khác…)."
        />
        <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
          Đánh dấu đã xử lý
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export default async function BankTransactionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const params = await searchParams;
  const filter = BANK_FILTERS.find((f) => f === params.tab) ?? 'pending';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  // Truy vấn chạy song song với bước đọc quyền (RLS chặn dữ liệu ngoài quyền; reconcile_runs chỉ chủ sân đọc được).
  const [ctx, [{ rows, total, summary }, run]] = await withGuard(requireStaff(), () =>
    Promise.all([listBankTransactions(filter, page), getLastReconcileRun()]),
  );
  if (!isOwner(ctx) && !hasPermission(ctx, 'payment.record')) redirect('/admin/denied');
  const owner = isOwner(ctx);
  const lastRun = owner ? run : null;
  const pages = Math.max(1, Math.ceil(total / BANK_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Giao dịch ngân hàng"
        description="Tiền chuyển khoản SePay báo về. Nội dung có mã đơn RB… thì tự ghi vào đơn và xác nhận; còn lại chờ nhân viên xử lý ở đây."
        actions={
          isOwner(ctx) ? (
            <Link href="/admin/settings#chuyen-khoan" className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
              <Settings2 className="size-4" aria-hidden />
              Cài đặt SePay
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Panel>
          <Stat label="Tiền vào hôm nay" value={formatVnd(summary.todayAmount)} hint={`${summary.todayCount} giao dịch`} />
        </Panel>
        <Panel>
          <Stat label="Tự ghi vào đơn" value={summary.todayAuto} hint="Hôm nay, không cần thao tác" />
        </Panel>
        <Panel>
          <Stat
            label="Cần xử lý"
            value={<span className={summary.pending > 0 ? 'text-shuttle-deep' : undefined}>{summary.pending}</span>}
            hint="Sai nội dung, đơn hết hạn / đã hủy"
          />
        </Panel>
        <Panel>
          <Stat
            label="Tỷ lệ tự động"
            value={summary.todayCount > 0 ? `${Math.round((summary.todayAuto / summary.todayCount) * 100)}%` : '—'}
            hint="Hôm nay"
          />
        </Panel>
      </div>

      {owner && <ReconcileBar run={lastRun} tokenReady={Boolean(getSepayApiConfig().token)} />}

      <LinkTabs
        label="Lọc giao dịch"
        tabs={BANK_FILTERS.map((f) => ({
          href: f === 'pending' ? '/admin/bank' : `/admin/bank?tab=${f}`,
          label: f === 'pending' && summary.pending > 0 ? `${TAB_LABEL[f]} (${summary.pending})` : TAB_LABEL[f],
          active: f === filter,
        }))}
      />

      {rows.length === 0 ? (
        <EmptyState title={filter === 'pending' ? 'Không có giao dịch cần xử lý' : 'Chưa có giao dịch'}>
          {filter === 'pending'
            ? 'Mọi khoản chuyển khoản đều đã khớp đơn. Tuyệt vời!'
            : 'Giao dịch sẽ hiện ở đây khi SePay báo tiền vào tài khoản.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const st = STATUS[row.status] ?? { label: row.status, tone: 'neutral' as const };
            const pending = row.status === 'unmatched' || row.status === 'review';
            return (
              <li key={row.id} className="flex flex-col gap-3 rounded-panel border border-line bg-paper p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-court-soft text-court-deep">
                    <ArrowDownLeft className="size-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-2xl text-court-deep tabular">+{formatVnd(row.amount)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {row.status === 'matched' && !row.resolved_at && (
                        <span className="inline-flex items-center gap-1 text-xs text-court-deep">
                          <Zap className="size-3.5" aria-hidden />
                          Tự động
                        </span>
                      )}
                    </div>
                    <p className="text-sm break-words">
                      <span className="text-muted">Nội dung: </span>
                      {row.content || '—'}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(row.transaction_at)}
                      {row.gateway ? ` · ${row.gateway}` : ''}
                      {row.account_number ? ` · TK ${row.account_number}` : ''}
                      {row.reference_code ? ` · Mã GD ${row.reference_code}` : ''}
                    </p>
                  </div>
                  {row.bookings && row.booking_id && (
                    <Link
                      href={`/admin/bookings/${row.booking_id}`}
                      className="flex shrink-0 flex-col items-end text-right text-sm hover:underline"
                    >
                      <span className="font-display text-lg tracking-wide">{row.bookings.code}</span>
                      <span className="text-muted">
                        {row.bookings.contact_name}
                        {row.branches ? ` · ${row.branches.name}` : ''}
                      </span>
                    </Link>
                  )}
                </div>
                {row.status_note && (
                  <p
                    className={
                      row.status === 'review'
                        ? 'flex items-start gap-2 rounded-control bg-shuttle-soft px-3 py-2 text-sm text-shuttle-deep'
                        : 'text-sm text-muted'
                    }
                  >
                    {row.status === 'review' && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
                    {row.status_note}
                  </p>
                )}
                {pending && <PendingActions row={row} />}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Trang" className="mt-6 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={`/admin/bank?tab=${filter}&page=${page - 1}`} className="underline underline-offset-4">
              ← Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Trang {page}/{pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/bank?tab=${filter}&page=${page + 1}`} className="underline underline-offset-4">
              Trang sau →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
