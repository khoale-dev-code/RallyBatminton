'use client';

import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useOffline } from '@/features/manager/lib/connectivity';
import { formatVnd } from '@/lib/format';

import { usePos } from '../hooks/use-pos';
import { applyPendingStock } from '../offline/lib';
import { useOfflineSales } from '../offline/store';
import { cartTax, changeDue, filterItems, type PosItem } from '../lib/cart';

import { CartPanel, EMPTY_FORM, moneyInput, type CheckoutForm } from './cart-panel';
import { OfflineQueuePanel } from './offline-queue-panel';
import { PosHeader } from './pos-header';
import { CatalogToolbar, ProductGrid } from './product-grid';
import { ReceiptView, type ReceiptBrand } from './receipt-view';
import { type BankAccount } from '@/features/payments/lib/transfer';

interface PosTerminalProps {
  /** Tài khoản thu ngân + chi nhánh: để lưu đơn trên máy khi mất mạng. */
  userId: string;
  branchId: string;
  branchName: string;
  cashierName: string;
  dateLabel: string;
  today: { count: number; revenue: number };
  brand: ReceiptBrand;
  items: PosItem[];
  categories: Array<{ id: string; name: string }>;
  canDiscount: boolean;
  /** Tài khoản nhận chuyển khoản của chi nhánh (mã QR); null = chưa cài. */
  bankAccount: BankAccount | null;
}

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Màn bán hàng tại quầy: chọn món bên trái, đơn hiện tại bên phải (điện thoại: mở dạng trang phủ). */
export function PosTerminal({
  userId,
  branchId,
  branchName,
  cashierName,
  dateLabel,
  today,
  brand,
  items: serverItems,
  categories,
  canDiscount,
  bankAccount,
}: PosTerminalProps) {
  const router = useRouter();
  const offline = useOffline();
  // Tồn trên máy = tồn máy chủ trừ các đơn bán lúc mất mạng chưa gửi (không bán vượt số hàng còn).
  const offlineSales = useOfflineSales();
  const items = useMemo(() => applyPendingStock(serverItems, offlineSales, branchId), [serverItems, offlineSales, branchId]);
  const pos = usePos(items, { userId, cashierName, branchId, branchName });
  // Mất mạng: không tải lại dữ liệu trang (tải lại sẽ rời khỏi quầy bán).
  const refresh = () => {
    if (!offline) router.refresh();
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [sheetOpen, setSheetOpen] = useState(false);

  const visible = useMemo(() => {
    const list = filterItems(items, category, query);
    return inStockOnly ? list.filter((i) => i.onHand > 0) : list;
  }, [items, category, query, inStockOnly]);

  const categoryChips = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const i of items) counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1);
    return [
      { id: null, name: 'Tất cả', count: items.length },
      ...categories.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 })).filter((c) => c.count > 0),
    ];
  }, [items, categories]);

  const discountValue = canDiscount ? Math.min(moneyInput(form.discount), pos.summary.subtotal) : 0;
  const total = pos.summary.subtotal - discountValue;
  const tax = cartTax(pos.summary.rows, discountValue);
  const change = form.method === 'cash' && form.tendered !== '' ? changeDue(total, moneyInput(form.tendered)) : null;

  function submit() {
    if (pos.summary.rows.length === 0 || pos.isPending) return;
    const tendered = form.method === 'cash' && form.tendered !== '' ? moneyInput(form.tendered) : null;
    if (tendered !== null && tendered < total) return;
    pos.checkout(
      {
        paymentMethod: form.method,
        paymentReference: form.method === 'cash' ? undefined : form.reference.trim() || undefined,
        discount: discountValue,
        customerPhone: form.phone.trim() || undefined,
        customerName: form.customerName.trim() || undefined,
        note: form.note.trim() || undefined,
      },
      {
        lines: pos.summary.rows.map((r) => ({
          key: r.key,
          variantId: r.item.variantId,
          unitName: r.item.unitId ? (r.item.unitName ?? null) : (r.item.unitLabel ?? null),
          name: r.item.name,
          variantLabel: r.item.variantLabel,
          quantity: r.quantity,
          unitPrice: r.item.price,
          lineTotal: r.lineTotal,
        })),
        subtotal: pos.summary.subtotal,
        discount: discountValue,
        vat: tax.vat,
        pit: tax.pit,
        taxMethod: tax.method,
        paymentMethod: form.method,
        paymentReference: form.reference.trim() || undefined,
        tendered,
        change: tendered !== null ? tendered - total : null,
        customerName: form.customerName.trim() || undefined,
        customerPhone: form.phone.trim() || undefined,
      },
    );
  }

  // Có mạng: nhờ service worker lưu bản quầy bán mới nhất (giá, tồn) — lỡ tải lại / mở lại ứng dụng lúc mất mạng vẫn bán được.
  useEffect(() => {
    if (offline || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_OFFLINE_PAGE', path: '/admin/pos' });
  }, [offline, serverItems]);

  // Phím tắt: "/" tìm món, Ctrl/⌘ + Enter thu tiền, Esc đóng đơn (điện thoại).
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitRef.current();
      } else if (e.key === 'Escape') {
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Khóa cuộn nền khi đơn đang mở dạng trang phủ trên điện thoại.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  function addFromSearch() {
    const only = visible.length === 1 ? visible[0] : undefined;
    if (only && pos.maxOf(only) > pos.quantityOf(only.key)) {
      pos.add(only);
      setQuery('');
    }
  }

  if (pos.receipt) {
    return (
      <div className="flex flex-col gap-4">
        <PosHeader
          branchName={branchName}
          cashierName={cashierName}
          dateLabel={dateLabel}
          todayCount={today.count}
          todayRevenue={today.revenue}
        />
        <ReceiptView
          receipt={pos.receipt}
          brand={brand}
          branchName={branchName}
          cashierName={cashierName}
          account={bankAccount}
          onPaid={(method) => {
            pos.markPaid(method);
            refresh();
          }}
          onNewOrder={() => {
            pos.dismissReceipt();
            setForm(EMPTY_FORM);
            setSheetOpen(false);
            refresh();
            window.setTimeout(() => searchRef.current?.focus(), 50);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <PosHeader
            branchName={branchName}
            cashierName={cashierName}
            dateLabel={dateLabel}
            todayCount={today.count}
            todayRevenue={today.revenue}
          />
          <OfflineQueuePanel userId={userId} />
          <CatalogToolbar
            ref={searchRef}
            query={query}
            onQuery={setQuery}
            onEnter={addFromSearch}
            inStockOnly={inStockOnly}
            onInStockOnly={setInStockOnly}
            categories={categoryChips}
            category={category}
            onCategory={setCategory}
          />
          <ProductGrid
            items={visible}
            quantityOf={pos.quantityOf}
            maxOf={pos.maxOf}
            onAdd={pos.add}
            onSetQuantity={pos.setQuantity}
            emptyMessage={
              items.length === 0
                ? 'Chi nhánh chưa có món để bán. Nhập kho và bật kênh “Quầy bán hàng” ở Quản lý sản phẩm.'
                : 'Không có món phù hợp. Thử từ khóa khác hoặc bỏ lọc.'
            }
          />
        </div>
        <CartPanel
          summary={pos.summary}
          form={form}
          onForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
          canDiscount={canDiscount}
          discountValue={discountValue}
          total={total}
          tax={tax}
          change={change}
          onSetQuantity={pos.setQuantity}
          onRemove={pos.remove}
          maxOf={pos.maxOf}
          onClear={pos.clear}
          onSubmit={submit}
          isPending={pos.isPending}
          error={pos.error}
          offline={offline}
          sheetOpen={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
        />
      </div>

      {/* Điện thoại / máy tính bảng: thanh đơn dính đáy */}
      {!sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center gap-3 rounded-panel bg-ink px-4 py-2 text-left text-paper shadow-lift lg:hidden"
        >
          <span className="relative">
            <ShoppingBag className="size-6" aria-hidden />
            {pos.summary.itemCount > 0 && (
              <span className="absolute -top-2 -right-2 grid min-w-5 place-items-center rounded-full bg-court px-1 text-xs font-medium text-on-court tabular">
                {pos.summary.itemCount}
              </span>
            )}
          </span>
          <span className="flex-1 text-sm">{pos.summary.itemCount > 0 ? 'Xem đơn và thu tiền' : 'Đơn đang trống'}</span>
          <span className="font-display text-xl tabular">{formatVnd(total)}</span>
        </button>
      )}
    </div>
  );
}
