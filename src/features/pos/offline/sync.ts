import { logCashDrawerAction } from '@/features/desktop/actions';
import { formatDateTime } from '@/lib/format';

import { recordOfflineSaleAction } from '../actions';
import { isRetryableSyncError, syncOrder, withTimeout, type OfflineSale } from './lib';
import { getOfflineSalesSnapshot, refreshOfflineSales, removeOfflineSale, saveOfflineSale } from './store';

export interface SyncReport {
  sent: number;
  failed: number;
  /** Dừng giữa chừng vì mất mạng / hết phiên — còn đơn chờ. */
  interrupted: boolean;
}

let running: Promise<SyncReport> | null = null;

/** Một tab / cửa sổ gửi tại một thời điểm (Web Locks); trình duyệt cũ không có thì chỉ khóa trong tab. */
async function withLock(work: () => Promise<SyncReport>): Promise<SyncReport> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return work();
  const result = await locks.request('rally-offline-pos-sync', { ifAvailable: true }, async (lock) =>
    lock ? work() : { sent: 0, failed: 0, interrupted: true },
  );
  return result;
}

async function sendOne(sale: OfflineSale): Promise<'sent' | 'failed' | 'stop'> {
  let res;
  try {
    res = await withTimeout(
      recordOfflineSaleAction({
        idempotencyKey: sale.id,
        sellerId: sale.userId,
        branchId: sale.branchId,
        soldAt: sale.soldAt,
        lines: sale.lines.map((l) => ({ variantId: l.variantId, unitId: l.unitId, quantity: l.quantity })),
        discount: sale.discount,
        expectedTotal: sale.total,
        note: sale.note,
        acceptServerTotal: sale.acceptServerTotal,
      }),
    );
  } catch {
    return 'stop'; // mất mạng giữa chừng: giữ nguyên, lần sau gửi lại (mã chống trùng → không ghi hai lần)
  }
  if (res.ok) {
    await removeOfflineSale(sale.id);
    if (sale.drawerOpened) {
      // Ngăn kéo đã mở lúc mất mạng: ghi nhật ký kèm mã đơn thật (không chặn nếu lỗi).
      await logCashDrawerAction({
        trigger: 'sale',
        refCode: res.code,
        device: `Mở lúc mất mạng ${formatDateTime(sale.soldAt)}`,
        branchId: sale.branchId,
      }).catch(() => undefined);
    }
    return 'sent';
  }
  if (isRetryableSyncError(res.code)) return 'stop';
  await saveOfflineSale({
    ...sale,
    status: 'failed',
    attempts: sale.attempts + 1,
    error: { code: res.code ?? 'UNKNOWN', message: res.error, serverTotal: res.serverTotal ?? null },
  });
  return 'failed';
}

/**
 * Gửi các đơn bán khi mất mạng của tài khoản đang đăng nhập, theo thứ tự giờ bán.
 * Đơn của tài khoản khác giữ nguyên chờ người đó đăng nhập (đơn ghi đúng tên thu ngân).
 */
export function syncOfflineSales(userId: string): Promise<SyncReport> {
  running ??= withLock(async () => {
    await refreshOfflineSales();
    const queue = syncOrder(getOfflineSalesSnapshot().filter((s) => s.userId === userId && s.status === 'pending'));
    const report: SyncReport = { sent: 0, failed: 0, interrupted: false };
    for (const sale of queue) {
      const outcome = await sendOne(sale);
      if (outcome === 'stop') {
        report.interrupted = true;
        break;
      }
      report[outcome] += 1;
    }
    return report;
  }).finally(() => {
    running = null;
  });
  return running;
}

/** Đơn lỗi → thử lại (tùy chọn: đồng ý ghi theo giá hiện tại). */
export async function retryOfflineSale(sale: OfflineSale, acceptServerTotal = false): Promise<void> {
  await saveOfflineSale({ ...sale, status: 'pending', error: null, acceptServerTotal: acceptServerTotal || sale.acceptServerTotal });
}
