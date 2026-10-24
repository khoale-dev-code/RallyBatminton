'use client';

import { CloudOff, CloudUpload, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@/components/ui/toast';
import { useOffline } from '@/features/manager/lib/connectivity';
import { formatDateTime, formatVnd } from '@/lib/format';

import { isTooOld, offlineReceiptCode, summarizePending, type OfflineSale } from '../offline/lib';
import { removeOfflineSale, useOfflineSales } from '../offline/store';
import { retryOfflineSale, syncOfflineSales } from '../offline/sync';

function FailedSale({ sale, onChanged }: { sale: OfflineSale; onChanged: () => void }) {
  const [confirmDrop, setConfirmDrop] = useState(false);
  const priceChanged = sale.error?.code === 'OFFLINE_PRICE_CHANGED' && sale.error.serverTotal !== null;
  const items = sale.lines.map((l) => `${l.quantity} ${l.name}`).join(', ');
  return (
    <li className="flex flex-col gap-2 rounded-control border border-shuttle/40 bg-paper p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium tabular">
          {offlineReceiptCode(sale.id)} · {formatVnd(sale.total)}
        </span>
        <span className="text-xs text-muted">{formatDateTime(sale.soldAt)}</span>
      </div>
      <p className="text-muted">{items}</p>
      <p className="text-shuttle-deep">
        {sale.error?.message}
        {priceChanged && ` Đã thu ${formatVnd(sale.total)}, giá hiện tại ${formatVnd(sale.error?.serverTotal ?? 0)}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {priceChanged ? (
          <button
            type="button"
            onClick={() => void retryOfflineSale(sale, true).then(onChanged)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-ink px-3 text-paper"
          >
            Ghi theo giá hiện tại {formatVnd(sale.error?.serverTotal ?? 0)}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void retryOfflineSale(sale).then(onChanged)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 hover:border-ink"
          >
            <RotateCcw className="size-4" aria-hidden />
            Gửi lại
          </button>
        )}
        {confirmDrop ? (
          <button
            type="button"
            onClick={() => void removeOfflineSale(sale.id).then(() => toast.info(`Đã bỏ đơn ${offlineReceiptCode(sale.id)} khỏi máy.`))}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-shuttle-deep px-3 text-paper"
          >
            <Trash2 className="size-4" aria-hidden />
            Chắc chắn bỏ (đã ghi tay / trả lại tiền)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDrop(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 text-muted hover:text-shuttle-deep"
          >
            <Trash2 className="size-4" aria-hidden />
            Bỏ đơn
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Đơn bán khi mất mạng của quầy này: số đơn chờ gửi, tự gửi khi có mạng (và mỗi 30 giây nếu còn đơn),
 * đơn lỗi cần người xử lý (giá đổi, hết hàng trên hệ thống, món ngừng bán…).
 */
export function OfflineQueuePanel({ userId }: { userId: string }) {
  const router = useRouter();
  const offline = useOffline();
  const sales = useOfflineSales();
  const [busy, setBusy] = useState(false);
  const summary = summarizePending(sales, userId);

  const sync = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      try {
        const report = await syncOfflineSales(userId);
        if (report.sent > 0) {
          toast.success(`Đã gửi ${report.sent} đơn bán lúc mất mạng lên máy chủ.`);
          router.refresh();
        }
        if (report.failed > 0) toast.error(`${report.failed} đơn bán lúc mất mạng cần xử lý — xem ở đầu quầy bán.`);
        if (manual && report.interrupted && report.sent === 0) toast.error('Chưa gửi được — kiểm tra kết nối rồi thử lại.');
      } finally {
        setBusy(false);
      }
    },
    [router, userId],
  );

  // Có mạng + còn đơn chờ: gửi ngay (thử lại định kỳ do ManagerRuntime lo, cả khi đang ở màn phiếu).
  const hasPending = summary.pending > 0;
  useEffect(() => {
    if (offline || !hasPending) return;
    const first = window.setTimeout(() => void sync(false), 800);
    return () => window.clearTimeout(first);
  }, [offline, hasPending, sync]);

  if (!offline && summary.pending === 0 && summary.failed.length === 0 && summary.others === 0) return null;

  const tooOld = sales.some((s) => s.userId === userId && s.status === 'pending' && isTooOld(s));

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-panel border border-amber-deep/30 bg-amber-soft p-3 text-sm text-amber-deep"
    >
      {offline && (
        <p className="flex items-start gap-2 font-medium">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Đang mất mạng — vẫn bán được bằng tiền mặt. Đơn lưu trên máy này (mã tạm TAM-…) và tự gửi lên khi có mạng. Không xóa dữ liệu trình
          duyệt / đổi máy cho tới khi gửi xong.
        </p>
      )}
      {summary.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            <strong>{summary.pending}</strong> đơn bán lúc mất mạng chờ gửi · {formatVnd(summary.pendingTotal)}
          </p>
          <button
            type="button"
            disabled={offline || busy}
            onClick={() => void sync(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-ink px-3 text-paper disabled:opacity-50"
          >
            <CloudUpload className="size-4" aria-hidden />
            {busy ? 'Đang gửi…' : 'Gửi ngay'}
          </button>
        </div>
      )}
      {tooOld && <p>Có đơn đã quá 72 giờ — máy chủ sẽ không nhận; chủ sân ghi lại bằng tay rồi bỏ đơn khỏi máy.</p>}
      {summary.others > 0 && (
        <p>
          {summary.others} đơn của tài khoản khác đang chờ trên máy này — người đó đăng nhập lại trên máy này để gửi (đơn ghi đúng tên thu
          ngân).
        </p>
      )}
      {summary.failed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4" aria-hidden />
            {summary.failed.length} đơn không gửi được — cần xử lý
          </p>
          <ul className="flex flex-col gap-2">
            {summary.failed.map((s) => (
              <FailedSale key={s.id} sale={s} onChanged={() => void sync(true)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
