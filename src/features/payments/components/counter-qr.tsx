'use client';

import { Check, Copy, LoaderCircle } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

import { vietQrImageUrl, type BankAccount } from '../lib/transfer';

function CopyRow({ label, value, display, strong }: { label: string; value: string; display?: string; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate text-right tabular', strong ? 'font-display text-lg tracking-wide' : 'font-medium')}>
          {display ?? value}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          aria-label={`Sao chép ${label.toLowerCase()}`}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-ink hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-court-deep" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </span>
    </div>
  );
}

/**
 * Mã VietQR cho khách quét tại quầy: đúng số tiền + nội dung chuyển khoản. Tiền về → SePay báo website →
 * màn hình tự chuyển sang "Đã nhận tiền" (component cha hỏi lại trạng thái).
 */
export function CounterQr({ account, amount, content }: { account: BankAccount; amount: number; content: string }) {
  return (
    <div className="@container">
      <div className="grid gap-5 @xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @xl:items-center">
        <div className="mx-auto w-full max-w-60 rounded-panel border border-line bg-paper p-2">
          <Image
            src={vietQrImageUrl(account, amount, content)}
            alt={`Mã QR chuyển ${formatVnd(amount)}, nội dung ${content}`}
            width={480}
            height={560}
            unoptimized
            priority
            className="h-auto w-full"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="divide-y divide-line">
            <CopyRow label="Số tiền" value={String(amount)} display={formatVnd(amount)} strong />
            <CopyRow label="Nội dung" value={content} strong />
            <CopyRow label="Số tài khoản" value={account.accountNo} />
            <div className="flex justify-between gap-3 py-2 text-sm">
              <span className="text-muted">Ngân hàng</span>
              <span className="text-right font-medium">
                {account.bankCode}
                {account.accountName ? ` · ${account.accountName}` : ''}
              </span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-control bg-hall px-3 py-2 text-sm" role="status" aria-live="polite">
            <LoaderCircle className="size-4 shrink-0 animate-spin text-court-deep" aria-hidden />
            Đang chờ khách chuyển khoản — tiền về sẽ tự xác nhận.
          </p>
        </div>
      </div>
    </div>
  );
}
