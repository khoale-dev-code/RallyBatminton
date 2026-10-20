'use client';

import { Banknote, CircleX, LoaderCircle } from 'lucide-react';
import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { CounterQr } from '@/features/payments/components/counter-qr';
import { transferContent, type BankAccount } from '@/features/payments/lib/transfer';
import { formatVnd } from '@/lib/format';

import { cancelPendingSaleAction, saleTransferStatusAction, settlePendingSaleAction } from '../actions';

const POLL_MS = 3000;

/**
 * Đơn bán chờ khách chuyển khoản: mã QR đúng số tiền + nội dung RB…; SePay báo tiền về → tự sang "Đã thu".
 * Khách đổi ý: thu tiền mặt; khách không chuyển: hủy đơn (hàng về kho).
 */
export function PendingTransfer({
  saleId,
  code,
  total,
  transferCode,
  account,
  onPaid,
  onCancelled,
}: {
  saleId: string;
  code: string;
  total: number;
  transferCode: string;
  account: BankAccount | null;
  onPaid: (method?: 'cash' | 'bank_transfer') => void;
  onCancelled: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [mode, setMode] = useState<'wait' | 'manual' | 'cancel'>('wait');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');

  const poll = useEffectEvent(async () => {
    const s = await saleTransferStatusAction(saleId);
    if (!s) return;
    if (s.sale_status === 'voided') {
      onCancelled();
      return;
    }
    if (!s.pending && s.paid >= s.total_amount) {
      toast.success(`Khách đã chuyển khoản ${formatVnd(s.total_amount)} — đơn ${code}.`);
      onPaid();
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const settle = (method: 'cash' | 'bank_transfer') =>
    startTransition(async () => {
      const res = await settlePendingSaleAction(saleId, method, method === 'bank_transfer' ? reference : undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(method === 'cash' ? `Đã thu ${formatVnd(total)} tiền mặt — đơn ${code}.` : `Đã ghi nhận chuyển khoản — đơn ${code}.`);
      onPaid(method);
    });

  const cancel = () =>
    startTransition(async () => {
      const res = await cancelPendingSaleAction(saleId, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.info(`Đã hủy đơn ${code}, hàng đã trả về kho.`);
      onCancelled();
    });

  return (
    <section aria-live="polite" className="flex flex-col gap-5 rounded-panel border border-line bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Khách chuyển khoản · đơn {code}</p>
          <p className="font-display text-5xl leading-none tabular">{formatVnd(total)}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-sm font-medium text-amber-deep">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Chờ tiền về
        </span>
      </div>

      {account ? (
        <CounterQr account={account} amount={total} content={transferContent(transferCode, account.memoPrefix)} />
      ) : (
        <p className="rounded-control bg-amber-soft p-3 text-sm text-amber-deep">
          Chưa khai báo tài khoản nhận chuyển khoản (Cài đặt thương hiệu). Nội dung chuyển khoản: <strong>{transferCode}</strong>
        </p>
      )}

      {mode === 'wait' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => settle('cash')} disabled={busy}>
            <Banknote className="size-4" aria-hidden />
            Khách trả tiền mặt
          </Button>
          <Button variant="ghost" onClick={() => setMode('manual')} disabled={busy}>
            Đã thấy tiền về nhưng chưa xác nhận?
          </Button>
          <Button variant="ghost" onClick={() => setMode('cancel')} disabled={busy} className="text-shuttle-deep">
            <CircleX className="size-4" aria-hidden />
            Hủy đơn
          </Button>
        </div>
      )}
      {mode === 'manual' && (
        <div className="flex flex-col gap-2 rounded-control border border-line p-3">
          <label htmlFor="pos-manual-ref" className="text-sm font-medium">
            Mã giao dịch ngân hàng (xem trong app ngân hàng)
          </label>
          <input
            id="pos-manual-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={100}
            placeholder="FT26293…"
            className="min-h-11 rounded-control border border-line bg-paper px-3"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => settle('bank_transfer')} disabled={busy || reference.trim().length < 3}>
              Ghi nhận đã chuyển {formatVnd(total)}
            </Button>
            <Button variant="ghost" onClick={() => setMode('wait')} disabled={busy}>
              Quay lại
            </Button>
          </div>
        </div>
      )}
      {mode === 'cancel' && (
        <div className="flex flex-col gap-2 rounded-control border border-shuttle/40 p-3">
          <label htmlFor="pos-cancel-reason" className="text-sm font-medium">
            Lý do hủy đơn
          </label>
          <input
            id="pos-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Khách không chuyển khoản, đổi ý…"
            className="min-h-11 rounded-control border border-line bg-paper px-3"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={cancel} disabled={busy || reason.trim().length < 3}>
              Hủy đơn, trả hàng về kho
            </Button>
            <Button variant="ghost" onClick={() => setMode('wait')} disabled={busy}>
              Quay lại
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
