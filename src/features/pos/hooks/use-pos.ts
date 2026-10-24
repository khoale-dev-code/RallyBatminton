'use client';

import { useMemo, useReducer, useRef, useState, useTransition } from 'react';

import { recordSaleAction, type SaleInput } from '../actions';
import { cartReducer, maxQuantity, summarizeCart, type PosItem } from '../lib/cart';
import { toast } from '@/components/ui/toast';
import { openDrawerAfterPayment } from '@/features/desktop/print';
import { isOfflineNow } from '@/features/manager/lib/connectivity';
import { offlineCheckoutProblem, offlineReceiptCode, withTimeout, type OfflineSale } from '../offline/lib';
import { saveOfflineSale } from '../offline/store';
import { formatVnd } from '@/lib/format';

export interface CheckoutDetails {
  paymentMethod: SaleInput['paymentMethod'];
  paymentReference?: string;
  discount: number;
  customerPhone?: string;
  customerName?: string;
  note?: string;
}

export interface ReceiptLine {
  key: string;
  variantId: string;
  unitName: string | null;
  name: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Ảnh chụp đơn ngay lúc thu tiền — dùng để in phiếu (giỏ hàng đã được xóa sau khi ghi đơn). */
export interface ReceiptSnapshot {
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  vat: number;
  pit: number;
  taxMethod: 'deduction' | 'direct' | null;
  paymentMethod: CheckoutDetails['paymentMethod'];
  paymentReference?: string;
  tendered: number | null;
  change: number | null;
  customerName?: string;
  customerPhone?: string;
}

export interface Receipt {
  saleId: string;
  code: string;
  total: number;
  replayed: boolean;
  /** Đang chờ khách quét QR chuyển khoản (nội dung RB…); null = đã thu. */
  transferCode: string | null;
  soldAt: string;
  snapshot: ReceiptSnapshot;
  /** Bán lúc mất mạng: đơn đang lưu trên máy, chờ gửi (mã tạm TAM-…). */
  offline?: boolean;
}

/** Thông tin để lưu đơn trên máy khi mất mạng. */
export interface OfflineContext {
  userId: string;
  cashierName: string;
  branchId: string;
  branchName: string;
}

/** Trạng thái quầy bán: giỏ hàng + gửi đơn có khóa chống trùng (bấm 2 lần không tạo 2 đơn). */
export function usePos(items: PosItem[], offline: OfflineContext | null = null) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isPending, startTransition] = useTransition();
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const summary = useMemo(() => summarizeCart(lines, itemMap), [lines, itemMap]);
  const quantityOf = (key: string) => lines.find((l) => l.key === key)?.quantity ?? 0;
  const maxOf = (item: PosItem) => maxQuantity(item, lines, itemMap);

  /** Mất mạng: lưu đơn (tiền mặt, không thông tin khách) vào máy, in phiếu tạm, tự gửi khi có mạng. */
  async function saveOffline(ctx: OfflineContext, details: CheckoutDetails, snapshot: ReceiptSnapshot, key: string) {
    const problem = offlineCheckoutProblem(details);
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    const soldAt = new Date().toISOString();
    const total = summary.subtotal - details.discount;
    const sale: OfflineSale = {
      id: key,
      userId: ctx.userId,
      cashierName: ctx.cashierName,
      branchId: ctx.branchId,
      branchName: ctx.branchName,
      soldAt,
      lines: summary.rows.map((r) => ({
        variantId: r.item.variantId,
        unitId: r.item.unitId ?? null,
        quantity: r.quantity,
        conversion: Math.max(1, r.item.conversion ?? 1),
        name: r.item.name,
        variantLabel: r.item.variantLabel,
        unitName: r.item.unitId ? (r.item.unitName ?? null) : (r.item.unitLabel ?? null),
        unitPrice: r.item.price,
        lineTotal: r.lineTotal,
      })),
      discount: details.discount,
      total,
      tendered: snapshot.tendered,
      note: details.note ?? null,
      drawerOpened: false,
      status: 'pending',
      error: null,
      acceptServerTotal: false,
      attempts: 0,
    };
    try {
      await saveOfflineSale(sale);
    } catch {
      const msg = 'Không lưu được đơn trên máy (bộ nhớ trình duyệt bị chặn / đầy). Ghi đơn ra giấy và nhập lại khi có mạng.';
      setError(msg);
      toast.error(msg);
      return;
    }
    const code = offlineReceiptCode(key);
    attemptRef.current = null;
    dispatch({ type: 'clear' });
    setReceipt({ saleId: '', code, total, replayed: false, transferCode: null, soldAt, snapshot, offline: true });
    toast.info(`Mất mạng: đã lưu đơn ${code} trên máy — tự gửi lên khi có mạng.`);
    if (await openDrawerAfterPayment('cash', 'sale', code, { deferLog: true })) {
      await saveOfflineSale({ ...sale, drawerOpened: true }).catch(() => undefined);
    }
  }

  function checkout(details: CheckoutDetails, snapshot: ReceiptSnapshot) {
    if (summary.rows.length === 0 || isPending) return;
    const payload = summary.rows.map((r) => ({ variantId: r.item.variantId, unitId: r.item.unitId ?? null, quantity: r.quantity }));
    const signature = JSON.stringify([payload, details]);
    if (attemptRef.current?.signature !== signature) attemptRef.current = { signature, key: crypto.randomUUID() };
    const idempotencyKey = attemptRef.current.key;

    if (offline && isOfflineNow()) {
      startTransition(async () => {
        setError(null);
        await saveOffline(offline, details, snapshot, idempotencyKey);
      });
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const res = await withTimeout(recordSaleAction({ lines: payload, idempotencyKey, ...details }));
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        if (res.transferCode) toast.info(`Đơn ${res.code}: mời khách quét mã QR chuyển ${formatVnd(res.total)}.`);
        else toast.success(res.replayed ? `Đơn ${res.code} đã được ghi trước đó.` : `Đã thu ${formatVnd(res.total)} — đơn ${res.code}.`);
        attemptRef.current = null;
        dispatch({ type: 'clear' });
        setReceipt({
          saleId: res.saleId,
          code: res.code,
          total: res.total,
          replayed: res.replayed,
          transferCode: res.transferCode,
          soldAt: new Date().toISOString(),
          snapshot,
        });
        // Rally Manager cho Windows: thu tiền mặt xong → mở ngăn kéo (đơn ghi lại lần hai thì không mở).
        if (!res.transferCode && !res.replayed) void openDrawerAfterPayment(details.paymentMethod, 'sale', res.code);
      } catch {
        // Mất mạng đúng lúc gửi: tiền mặt → lưu trên máy với CÙNG mã chống trùng (nếu máy chủ đã kịp ghi thì lúc gửi lại
        // chỉ nhận lại đơn cũ, không ghi hai lần).
        if (offline && !offlineCheckoutProblem(details)) {
          await saveOffline(offline, details, snapshot, idempotencyKey);
          return;
        }
        setError('Mất kết nối khi gửi đơn. Bấm thanh toán lại — đơn sẽ không bị ghi trùng.');
      }
    });
  }

  return {
    lines,
    summary,
    quantityOf,
    maxOf,
    add: (item: PosItem) => dispatch({ type: 'add', item, max: maxOf(item) }),
    setQuantity: (key: string, quantity: number) => {
      const item = itemMap.get(key);
      dispatch({ type: 'set', key, quantity, max: item ? maxOf(item) : 0 });
    },
    remove: (key: string) => dispatch({ type: 'remove', key }),
    clear: () => dispatch({ type: 'clear' }),
    checkout,
    isPending,
    error,
    receipt,
    dismissReceipt: () => setReceipt(null),
    /** Tiền chuyển khoản đã về / khách đổi sang tiền mặt: đổi phiếu sang "đã thu". */
    markPaid: (method?: CheckoutDetails['paymentMethod']) => {
      if (method === 'cash' && receipt) void openDrawerAfterPayment('cash', 'sale', receipt.code);
      setReceipt((r) =>
        r
          ? {
              ...r,
              transferCode: null,
              snapshot: method ? { ...r.snapshot, paymentMethod: method, tendered: null, change: null } : r.snapshot,
            }
          : r,
      );
    },
  };
}
