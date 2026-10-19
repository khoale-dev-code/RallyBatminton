'use client';

import { useMemo, useReducer, useRef, useState, useTransition } from 'react';

import { recordSaleAction, type SaleInput } from '../actions';
import { cartReducer, maxQuantity, summarizeCart, type PosItem } from '../lib/cart';

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
  soldAt: string;
  snapshot: ReceiptSnapshot;
}

/** Trạng thái quầy bán: giỏ hàng + gửi đơn có khóa chống trùng (bấm 2 lần không tạo 2 đơn). */
export function usePos(items: PosItem[]) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isPending, startTransition] = useTransition();
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const summary = useMemo(() => summarizeCart(lines, itemMap), [lines, itemMap]);
  const quantityOf = (key: string) => lines.find((l) => l.key === key)?.quantity ?? 0;
  const maxOf = (item: PosItem) => maxQuantity(item, lines, itemMap);

  function checkout(details: CheckoutDetails, snapshot: ReceiptSnapshot) {
    if (summary.rows.length === 0 || isPending) return;
    const payload = summary.rows.map((r) => ({ variantId: r.item.variantId, unitId: r.item.unitId ?? null, quantity: r.quantity }));
    const signature = JSON.stringify([payload, details]);
    if (attemptRef.current?.signature !== signature) attemptRef.current = { signature, key: crypto.randomUUID() };
    const idempotencyKey = attemptRef.current.key;

    startTransition(async () => {
      setError(null);
      try {
        const res = await recordSaleAction({ lines: payload, idempotencyKey, ...details });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        attemptRef.current = null;
        dispatch({ type: 'clear' });
        setReceipt({
          saleId: res.saleId,
          code: res.code,
          total: res.total,
          replayed: res.replayed,
          soldAt: new Date().toISOString(),
          snapshot,
        });
      } catch {
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
  };
}
