'use client';

import { CircleCheck, Printer } from 'lucide-react';
import Link from 'next/link';

import { Button, buttonClass } from '@/components/ui/button';
import { formatDateTime, formatPhone, formatVnd } from '@/lib/format';
import { PAYMENT_METHOD } from '@/lib/labels';

import { printPage } from '@/features/desktop/print';
import { type BankAccount } from '@/features/payments/lib/transfer';

import { type Receipt } from '../hooks/use-pos';
import { PendingTransfer } from './pending-transfer';

export interface ReceiptBrand {
  name: string;
  addressLine: string | null;
  hotline: string | null;
  taxCode: string | null;
}

interface ReceiptViewProps {
  receipt: Receipt;
  brand: ReceiptBrand;
  branchName: string;
  cashierName: string;
  onNewOrder: () => void;
  account: BankAccount | null;
  onPaid: (method?: 'cash' | 'bank_transfer') => void;
}

/** Màn sau khi thu tiền: kết quả lớn, dễ đọc cho thu ngân + phiếu in khổ 80mm. */
export function ReceiptView({ receipt, brand, branchName, cashierName, onNewOrder, account, onPaid }: ReceiptViewProps) {
  const s = receipt.snapshot;
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {receipt.transferCode ? (
        <PendingTransfer
          saleId={receipt.saleId}
          code={receipt.code}
          total={receipt.total}
          transferCode={receipt.transferCode}
          account={account}
          onPaid={onPaid}
          onCancelled={onNewOrder}
        />
      ) : (
        <section aria-live="polite" className="flex flex-col items-start gap-5 rounded-panel border border-line bg-paper p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-court-soft px-3 py-1 text-sm font-medium text-court-deep">
            <CircleCheck className="size-4" aria-hidden />
            {receipt.replayed ? 'Đơn đã được ghi trước đó' : 'Đã ghi đơn'}
          </span>
          <div>
            <p className="text-sm text-muted">Đã thu ({PAYMENT_METHOD[s.paymentMethod]})</p>
            <p className="font-display text-5xl leading-none tabular sm:text-6xl">{formatVnd(receipt.total)}</p>
          </div>
          {s.change !== null && s.change > 0 && (
            <div className="rounded-panel bg-ink px-5 py-3 text-paper">
              <p className="text-sm text-paper/70">Tiền thối cho khách</p>
              <p className="font-display text-4xl tabular">{formatVnd(s.change)}</p>
            </div>
          )}
          <p>
            Mã đơn <span className="font-display text-2xl tabular">{receipt.code}</span>
          </p>
          <div className="flex w-full flex-wrap gap-2">
            <Button onClick={onNewOrder} size="lg" autoFocus className="flex-1 sm:flex-none">
              Đơn mới
            </Button>
            <Button onClick={() => void printPage()} size="lg" variant="outline">
              <Printer className="size-5" aria-hidden />
              In phiếu
            </Button>
            <Link href={`/admin/sales/${receipt.saleId}`} className={buttonClass('ghost', 'lg')}>
              Xem đơn
            </Link>
          </div>
        </section>
      )}

      <article
        id="pos-receipt"
        aria-label="Phiếu thanh toán"
        className="w-full max-w-sm justify-self-center rounded-panel border border-line bg-paper p-5 text-sm leading-snug shadow-sm lg:max-w-none"
      >
        <header className="text-center">
          <p className="font-display text-xl">{brand.name}</p>
          <p>{branchName}</p>
          {brand.addressLine && <p className="text-muted">{brand.addressLine}</p>}
          {brand.hotline && <p className="text-muted">Hotline {brand.hotline}</p>}
          {brand.taxCode && <p className="text-muted">MST {brand.taxCode}</p>}
          <p className="mt-3 font-medium">Phiếu thanh toán</p>
          <p className="tabular">
            {receipt.code}, {formatDateTime(receipt.soldAt)}
          </p>
          <p className="text-muted">Thu ngân: {cashierName}</p>
          {(s.customerName || s.customerPhone) && (
            <p className="text-muted">
              Khách: {[s.customerName, s.customerPhone ? formatPhone(s.customerPhone) : null].filter(Boolean).join(', ')}
            </p>
          )}
        </header>
        <ul className="my-3 border-y border-dashed border-ink/40 py-2">
          {s.lines.map((l) => (
            <li key={l.key} className="py-1">
              <p>
                {l.name}
                {l.variantLabel ? ` (${l.variantLabel})` : ''}
              </p>
              <p className="flex justify-between tabular">
                <span>
                  {l.quantity}
                  {l.unitName ? ` ${l.unitName.toLowerCase()}` : ''} × {formatVnd(l.unitPrice)}
                </span>
                <span>{formatVnd(l.lineTotal)}</span>
              </p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-0.5 tabular">
          <div className="flex justify-between">
            <dt>Tạm tính</dt>
            <dd>{formatVnd(s.subtotal)}</dd>
          </div>
          {s.discount > 0 && (
            <div className="flex justify-between">
              <dt>Giảm giá</dt>
              <dd>−{formatVnd(s.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-medium">
            <dt>Tổng cộng</dt>
            <dd>{formatVnd(receipt.total)}</dd>
          </div>
          {s.taxMethod === 'deduction' && s.vat > 0 && (
            <div className="flex justify-between text-muted">
              <dt>Trong đó thuế VAT</dt>
              <dd>{formatVnd(s.vat)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between">
            <dt>
              {PAYMENT_METHOD[s.paymentMethod]}
              {receipt.transferCode ? ' (chờ tiền về)' : ''}
            </dt>
            <dd>{formatVnd(s.tendered ?? receipt.total)}</dd>
          </div>
          {s.change !== null && s.change > 0 && (
            <div className="flex justify-between">
              <dt>Tiền thối</dt>
              <dd>{formatVnd(s.change)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 border-t border-dashed border-ink/40 pt-2 text-center text-muted">
          Cảm ơn quý khách. Phiếu này không thay cho hóa đơn GTGT.
        </p>
      </article>
    </div>
  );
}
