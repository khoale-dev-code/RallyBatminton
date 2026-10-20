'use client';

import { Banknote, CircleCheckBig, Printer, QrCode, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useEffectEvent, useState } from 'react';

import { Button, buttonClass } from '@/components/ui/button';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { CounterQr } from '@/features/payments/components/counter-qr';
import { transferContent, type BankAccount } from '@/features/payments/lib/transfer';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/ids';

import { collectBookingPaymentAction, getCheckoutStatusAction, type CheckoutStatus } from '../actions';

const POLL_MS = 3000;
const QUICK_CASH = [50_000, 100_000, 200_000, 500_000];

function parseMoney(value: string): number {
  const n = Number(value.replace(/[.\s,₫đ]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Màn thu tiền một đơn: tiền mặt (tính tiền thối) hoặc QR chuyển khoản SePay tự xác nhận; xong thì in hóa đơn. */
export function CheckoutTerminal({
  bookingId,
  bookingCode,
  initial,
  account,
}: {
  bookingId: string;
  bookingCode: string;
  initial: CheckoutStatus;
  account: BankAccount | null;
}) {
  const [status, setStatus] = useState(initial);
  const [method, setMethod] = useState<'cash' | 'transfer'>(account ? 'transfer' : 'cash');
  const [given, setGiven] = useState('');
  const [idem, setIdem] = useState(() => newIdempotencyKey());
  const paid = status.due <= 0;
  const givenAmount = parseMoney(given);
  const change = givenAmount > 0 ? givenAmount - status.due : 0;

  async function load(announce: boolean) {
    const next = await getCheckoutStatusAction(bookingId);
    if (!next) return;
    if (announce && next.due <= 0) toast.success(`Khách đã chuyển khoản — đã thu đủ ${formatVnd(next.total)}.`);
    setStatus(next);
  }
  const refresh = useEffectEvent(() => load(true));

  // Chờ chuyển khoản: hỏi lại vài giây một lần và khi quay lại tab.
  useEffect(() => {
    if (paid || method !== 'transfer') return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [paid, method]);

  if (paid) {
    return (
      <section aria-live="polite" className="flex flex-col items-start gap-4 rounded-panel border border-court bg-court-soft p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-court-strong px-3 py-1 text-sm font-medium text-paper">
          <CircleCheckBig className="size-4" aria-hidden />
          Đã thu đủ
        </span>
        <p className="font-display text-5xl leading-none tabular">{formatVnd(status.paid)}</p>
        <p className="text-muted">Đơn {bookingCode} đã thanh toán đủ. Cảm ơn khách và mời khách ra về.</p>
        <div className="flex w-full flex-wrap gap-2">
          <Link href={`/admin/bookings/${bookingId}/invoice`} target="_blank" className={buttonClass('primary', 'lg')}>
            <Printer className="size-5" aria-hidden />
            In hóa đơn
          </Link>
          <Link href="/admin/checkout" className={buttonClass('outline', 'lg')}>
            Đơn khác
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-panel border border-line bg-paper p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Còn phải thu</p>
          <p className="font-display text-5xl leading-none tabular">{formatVnd(status.due)}</p>
        </div>
        {status.paid > 0 && <p className="text-sm text-muted">Đã thu trước {formatVnd(status.paid)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-control bg-hall p-1" role="tablist" aria-label="Hình thức thanh toán">
        {(
          [
            ['transfer', 'Chuyển khoản', <QrCode key="i" className="size-5" aria-hidden />],
            ['cash', 'Tiền mặt', <Banknote key="i" className="size-5" aria-hidden />],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.4rem] font-medium',
              method === value ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {method === 'transfer' ? (
        account ? (
          <div className="flex flex-col gap-4">
            <CounterQr account={account} amount={status.due} content={transferContent(bookingCode, account.memoPrefix)} />
            <details className="rounded-control border border-line px-3 py-2 text-sm">
              <summary className="min-h-9 cursor-pointer py-1.5 font-medium">Khách đã chuyển nhưng chưa thấy xác nhận?</summary>
              <p className="mb-3 text-muted">
                Kiểm tra app ngân hàng đã nhận tiền rồi ghi tay kèm mã giao dịch (giao dịch SePay đến sau sẽ vào mục Giao dịch ngân hàng để
                đối chiếu).
              </p>
              <ActionForm
                action={collectBookingPaymentAction}
                className="gap-3"
                onSuccess={() => {
                  setIdem(newIdempotencyKey());
                  void load(false);
                }}
              >
                <input type="hidden" name="booking_id" value={bookingId} />
                <input type="hidden" name="method" value="bank_transfer" />
                <input type="hidden" name="amount" value={status.due} />
                <input type="hidden" name="idempotency_key" value={idem} />
                <TextField name="reference" label="Mã giao dịch ngân hàng" required placeholder="FT26293…" />
                <SubmitButton variant="outline" pendingLabel="Đang ghi…">
                  Ghi nhận đã chuyển {formatVnd(status.due)}
                </SubmitButton>
              </ActionForm>
            </details>
          </div>
        ) : (
          <p className="rounded-control bg-amber-soft p-3 text-sm text-amber-deep">
            Chưa khai báo tài khoản nhận chuyển khoản. Chủ sân vào Cài đặt thương hiệu → Nhận cọc chuyển khoản để bật mã QR.
          </p>
        )
      ) : (
        <ActionForm
          action={collectBookingPaymentAction}
          onSuccess={() => {
            setIdem(newIdempotencyKey());
            void load(false);
          }}
        >
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="method" value="cash" />
          <input type="hidden" name="amount" value={status.due} />
          <input type="hidden" name="idempotency_key" value={idem} />
          <TextField
            name="_given"
            label="Khách đưa"
            inputMode="numeric"
            value={given}
            onChange={(e) => setGiven(e.target.value)}
            placeholder={formatVnd(status.due)}
            optional
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setGiven(String(status.due))}>
              Đủ tiền
            </Button>
            {QUICK_CASH.filter((v) => v >= status.due).map((v) => (
              <Button key={v} size="sm" variant="outline" onClick={() => setGiven(String(v))}>
                {formatVnd(v)}
              </Button>
            ))}
            {given && (
              <Button size="sm" variant="ghost" onClick={() => setGiven('')}>
                <Undo2 className="size-4" aria-hidden />
                Xóa
              </Button>
            )}
          </div>
          {givenAmount > 0 && (
            <p className={cn('rounded-control px-4 py-3', change >= 0 ? 'bg-ink text-paper' : 'bg-shuttle-soft text-shuttle-deep')}>
              {change >= 0 ? (
                <>
                  <span className="block text-sm text-paper/70">Tiền thối cho khách</span>
                  <span className="font-display text-3xl tabular">{formatVnd(change)}</span>
                </>
              ) : (
                <>Khách đưa thiếu {formatVnd(-change)}</>
              )}
            </p>
          )}
          <SubmitButton size="lg" pendingLabel="Đang ghi…">
            Thu {formatVnd(status.due)} tiền mặt
          </SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
