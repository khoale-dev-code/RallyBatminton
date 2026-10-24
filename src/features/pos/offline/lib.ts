import { z } from 'zod';

import { type PosItem } from '../lib/cart';

/**
 * Bán hàng khi mất mạng — phần thuần (không phụ thuộc trình duyệt). Đơn lưu trên máy KHÔNG có thông tin khách;
 * giá / kho / quyền vẫn do database quyết định lúc gửi lên (26_offline_pos.sql).
 */

/** Database chỉ nhận đơn bán trong 72 giờ gần nhất. */
export const OFFLINE_MAX_AGE_MS = 72 * 3600_000;

export const offlineLineSchema = z.object({
  variantId: z.uuid(),
  unitId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(1000),
  /** Số đơn vị cơ bản trong 1 đơn vị bán (trừ tồn trên máy). */
  conversion: z.number().int().min(1).max(100_000),
  name: z.string().max(200),
  variantLabel: z.string().max(200).nullable(),
  unitName: z.string().max(60).nullable(),
  unitPrice: z.number().int().min(0),
  lineTotal: z.number().int().min(0),
});
export type OfflineLine = z.infer<typeof offlineLineSchema>;

export const offlineSaleSchema = z.object({
  /** = mã chống trùng gửi lên máy chủ. */
  id: z.string().min(8).max(100),
  userId: z.uuid(),
  cashierName: z.string().max(120),
  branchId: z.uuid(),
  branchName: z.string().max(200),
  soldAt: z.iso.datetime({ offset: true }),
  lines: z.array(offlineLineSchema).min(1).max(30),
  discount: z.number().int().min(0),
  total: z.number().int().min(0),
  tendered: z.number().int().min(0).nullable(),
  note: z.string().max(250).nullable(),
  drawerOpened: z.boolean(),
  status: z.enum(['pending', 'failed']),
  error: z.object({ code: z.string(), message: z.string(), serverTotal: z.number().int().nullable() }).nullable(),
  acceptServerTotal: z.boolean(),
  attempts: z.number().int().min(0),
});
export type OfflineSale = z.infer<typeof offlineSaleSchema>;

/** Mã tạm in trên phiếu khi chưa có mã đơn của máy chủ. */
export function offlineReceiptCode(id: string): string {
  return `TAM-${id
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase()}`;
}

/**
 * Tồn trên máy sau khi trừ các đơn bán khi mất mạng CHƯA gửi của chi nhánh này — không bán vượt số hàng
 * máy biết là còn. Đơn đã gửi được thì máy chủ trả tồn mới.
 */
export function applyPendingStock(items: PosItem[], sales: OfflineSale[], branchId: string): PosItem[] {
  const used = new Map<string, number>();
  for (const s of sales) {
    if (s.branchId !== branchId) continue;
    for (const l of s.lines) used.set(l.variantId, (used.get(l.variantId) ?? 0) + l.quantity * l.conversion);
  }
  if (used.size === 0) return items;
  return items.map((i) => {
    const take = used.get(i.variantId);
    if (!take) return i;
    const conv = Math.max(1, i.conversion ?? 1);
    const base = Math.max(0, (i.baseOnHand ?? i.onHand * conv) - take);
    return { ...i, baseOnHand: base, onHand: Math.floor(base / conv) };
  });
}

/** Lý do không bán được khi mất mạng (null = được). */
export function offlineCheckoutProblem(input: { paymentMethod: string; customerPhone?: string; customerName?: string }): string | null {
  if (input.paymentMethod !== 'cash') {
    return 'Đang mất mạng: chỉ thu được TIỀN MẶT. Chuyển khoản / thẻ / ví cần có mạng để ghi nhận.';
  }
  if (input.customerPhone || input.customerName) {
    return 'Đang mất mạng: không lưu được thông tin khách — xóa số điện thoại / tên khách rồi thu tiền.';
  }
  return null;
}

/** Lỗi khi gửi đơn lên: tạm thời (giữ nguyên chờ lần sau) hay cần người xử lý. */
export function isRetryableSyncError(code: string | undefined): boolean {
  return code === undefined || code === 'AUTH_REQUIRED' || code === 'NETWORK' || code === 'MFA_REQUIRED';
}

/** Thứ tự gửi: đơn bán trước gửi trước (kho trừ đúng thứ tự). */
export function syncOrder(sales: OfflineSale[]): OfflineSale[] {
  return [...sales].sort((a, b) => a.soldAt.localeCompare(b.soldAt) || a.id.localeCompare(b.id));
}

export function summarizePending(sales: OfflineSale[], userId: string) {
  const mine = sales.filter((s) => s.userId === userId);
  const pending = mine.filter((s) => s.status === 'pending');
  return {
    pending: pending.length,
    pendingTotal: pending.reduce((sum, s) => sum + s.total, 0),
    failed: mine.filter((s) => s.status === 'failed'),
    others: sales.filter((s) => s.userId !== userId).length,
  };
}

/** Đơn quá hạn 72 giờ: máy chủ sẽ từ chối, báo ngay cho người dùng. */
export function isTooOld(sale: Pick<OfflineSale, 'soldAt'>, now: number = Date.now()): boolean {
  return now - Date.parse(sale.soldAt) > OFFLINE_MAX_AGE_MS;
}

/** Thời gian chờ tối đa cho một lần gửi đơn: mạng chập chờn có thể làm yêu cầu treo mãi thay vì báo lỗi. */
export const SEND_TIMEOUT_MS = 15_000;

export class SendTimeoutError extends Error {
  constructor() {
    super('Hết thời gian chờ máy chủ');
    this.name = 'SendTimeoutError';
  }
}

/**
 * Chờ tối đa `ms`; quá hạn thì ném SendTimeoutError. An toàn vì mọi lần gửi đều có mã chống trùng: nếu máy chủ
 * vẫn kịp ghi thì lần gửi lại chỉ nhận lại đơn cũ.
 */
export function withTimeout<T>(work: Promise<T>, ms: number = SEND_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SendTimeoutError()), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
