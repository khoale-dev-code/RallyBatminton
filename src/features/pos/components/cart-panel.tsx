'use client';

import { Banknote, CreditCard, Landmark, Minus, Plus, ShoppingBag, Trash2, UserRound, Wallet, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD, type ManualPaymentMethod } from '@/lib/labels';
import { taxLabel } from '@/lib/tax';

import { cashSuggestions, unitCaption, type CartSummary, type PosItem } from '../lib/cart';

const METHOD_ICON: Record<ManualPaymentMethod, LucideIcon> = {
  cash: Banknote,
  bank_transfer: Landmark,
  card: CreditCard,
  e_wallet: Wallet,
};

export interface CheckoutForm {
  method: ManualPaymentMethod;
  reference: string;
  tendered: string;
  discount: string;
  phone: string;
  customerName: string;
  note: string;
}

export const EMPTY_FORM: CheckoutForm = {
  method: 'cash',
  reference: '',
  tendered: '',
  discount: '',
  phone: '',
  customerName: '',
  note: '',
};

export const moneyInput = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;

interface CartPanelProps {
  summary: CartSummary;
  form: CheckoutForm;
  onForm: (patch: Partial<CheckoutForm>) => void;
  canDiscount: boolean;
  discountValue: number;
  total: number;
  tax: { vat: number; pit: number; method: 'deduction' | 'direct' | null };
  change: number | null;
  onSetQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  maxOf: (item: PosItem) => number;
  onClear: () => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
  /** Điện thoại: hiện dạng trang phủ, có nút đóng. */
  sheetOpen: boolean;
  onCloseSheet: () => void;
}

/** Cột đơn hiện tại: món, khách, tổng tiền, thuế đã gồm, cách thanh toán và nút thu tiền. */
export function CartPanel(props: CartPanelProps) {
  const { summary, form, onForm, canDiscount, discountValue, total, tax, change, isPending, error, sheetOpen } = props;
  const [customerOpen, setCustomerOpen] = useState(false);
  const empty = summary.rows.length === 0;
  const tendered = moneyInput(form.tendered);
  const short = form.method === 'cash' && form.tendered !== '' && tendered < total ? total - tendered : 0;

  return (
    <section
      id="pos-cart"
      aria-label="Đơn hiện tại"
      className={cn(
        'flex-col overflow-hidden bg-paper',
        // Điện thoại/máy tính bảng: trang phủ toàn màn hình. Máy tính: cột dính bên phải.
        sheetOpen ? 'fixed inset-0 z-40 flex' : 'hidden',
        'lg:sticky lg:top-6 lg:z-auto lg:flex lg:h-[calc(100dvh-3rem)] lg:rounded-panel lg:border lg:border-line',
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-xl">Đơn hiện tại</h2>
        {summary.itemCount > 0 && (
          <span className="rounded-full bg-court-soft px-2 py-0.5 text-sm font-medium text-court-deep tabular">
            {summary.itemCount} món
          </span>
        )}
        <span className="flex-1" />
        {!empty && (
          <button
            type="button"
            onClick={props.onClear}
            className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted hover:bg-hall hover:text-shuttle-deep"
          >
            <Trash2 className="size-4" aria-hidden />
            Xóa hết
          </button>
        )}
        <button
          type="button"
          onClick={props.onCloseSheet}
          aria-label="Đóng, tiếp tục chọn món"
          className="grid size-10 place-items-center rounded-control hover:bg-hall lg:hidden"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Khách hàng */}
      <div className="border-b border-line px-4 py-2">
        <button
          type="button"
          onClick={() => setCustomerOpen((o) => !o)}
          aria-expanded={customerOpen}
          aria-controls="pos-customer"
          className="flex min-h-10 w-full items-center gap-2 text-left text-sm"
        >
          <UserRound className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {form.customerName || form.phone ? (
              <>
                <span className="font-medium">{form.customerName || 'Khách'}</span>
                {form.phone && <span className="text-muted">, {form.phone}</span>}
              </>
            ) : (
              <>
                Khách lẻ <span className="text-muted">(thêm số điện thoại để lưu lịch sử mua)</span>
              </>
            )}
          </span>
          <span className="text-sm text-court-deep">{customerOpen ? 'Xong' : 'Sửa'}</span>
        </button>
        <div id="pos-customer" hidden={!customerOpen} className="grid grid-cols-2 gap-2 pt-1 pb-2">
          <input
            value={form.phone}
            onChange={(e) => onForm({ phone: e.target.value })}
            inputMode="tel"
            autoComplete="off"
            placeholder="Số điện thoại"
            aria-label="Số điện thoại khách"
            className="min-h-11 min-w-0 rounded-control border border-line px-3"
          />
          <input
            value={form.customerName}
            onChange={(e) => onForm({ customerName: e.target.value })}
            maxLength={80}
            placeholder="Tên khách"
            aria-label="Tên khách"
            className="min-h-11 min-w-0 rounded-control border border-line px-3"
          />
          <input
            value={form.note}
            onChange={(e) => onForm({ note: e.target.value })}
            maxLength={300}
            placeholder="Ghi chú đơn"
            aria-label="Ghi chú đơn"
            className="col-span-2 min-h-11 min-w-0 rounded-control border border-line px-3"
          />
        </div>
      </div>

      {/* Danh sách món */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {empty ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <ShoppingBag className="size-9 text-line" aria-hidden />
            <p className="font-medium">Chưa có món nào</p>
            <p className="text-sm text-muted">Chạm vào món hoặc quét mã vạch để thêm vào đơn.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {summary.rows.map((r) => (
              <li key={r.key} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-medium">{r.item.name}</span>
                    <span className="text-xs text-muted">
                      {[r.item.variantLabel, unitCaption(r.item), r.item.tax ? taxLabel(r.item.tax) : null].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onRemove(r.key)}
                    aria-label={`Bỏ ${r.item.name}`}
                    className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hall hover:text-shuttle-deep"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-control border border-line">
                    <button
                      type="button"
                      onClick={() => props.onSetQuantity(r.key, r.quantity - 1)}
                      aria-label={`Bớt một ${r.item.name}`}
                      className="grid size-10 place-items-center hover:bg-hall"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>
                    <input
                      value={r.quantity}
                      inputMode="numeric"
                      aria-label={`Số lượng ${r.item.name}`}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => props.onSetQuantity(r.key, moneyInput(e.target.value))}
                      className="w-11 text-center tabular outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => props.onSetQuantity(r.key, r.quantity + 1)}
                      disabled={r.quantity >= props.maxOf(r.item)}
                      aria-label={`Thêm một ${r.item.name}`}
                      className="grid size-10 place-items-center hover:bg-hall disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>
                  <span className="text-sm text-muted tabular">× {formatVnd(r.item.price)}</span>
                  <span className="ml-auto font-medium tabular">{formatVnd(r.lineTotal)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tổng tiền & thanh toán */}
      <form
        className="flex flex-col gap-3 border-t border-line bg-hall/50 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Tạm tính</dt>
            <dd className="tabular">{formatVnd(summary.subtotal)}</dd>
          </div>
          {canDiscount && (
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="pos-discount" className="text-muted">
                  Giảm giá
                </label>
              </dt>
              <dd className="flex items-center gap-1.5">
                {[5, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={empty}
                    onClick={() => onForm({ discount: String(Math.round((summary.subtotal * pct) / 100 / 1000) * 1000) })}
                    className="min-h-8 rounded-full border border-line bg-paper px-2 text-xs hover:border-ink disabled:opacity-40"
                  >
                    {pct}%
                  </button>
                ))}
                <input
                  id="pos-discount"
                  value={form.discount}
                  onChange={(e) => onForm({ discount: e.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-9 w-24 rounded-control border border-line bg-paper px-2 text-right tabular"
                />
              </dd>
            </div>
          )}
          {discountValue > 0 && !canDiscount && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Giảm giá</dt>
              <dd className="tabular">−{formatVnd(discountValue)}</dd>
            </div>
          )}
          {tax.method === 'deduction' && tax.vat > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Đã gồm thuế VAT</dt>
              <dd className="text-muted tabular">{formatVnd(tax.vat)}</dd>
            </div>
          )}
          {tax.method === 'direct' && tax.vat + tax.pit > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Thuế khoán ước tính</dt>
              <dd className="text-muted tabular">{formatVnd(tax.vat + tax.pit)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <dt className="font-medium">Cần thu</dt>
            <dd className="font-display text-3xl tabular">{formatVnd(total)}</dd>
          </div>
        </dl>

        <fieldset>
          <legend className="sr-only">Hình thức thanh toán</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {MANUAL_PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <label
                  key={m}
                  className={cn(
                    'flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border px-1 text-center text-xs leading-tight has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30',
                    form.method === m ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
                  )}
                >
                  <input
                    type="radio"
                    name="pos-method"
                    value={m}
                    checked={form.method === m}
                    onChange={() => onForm({ method: m })}
                    className="sr-only"
                  />
                  <Icon className="size-4" aria-hidden />
                  {PAYMENT_METHOD[m]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {form.method === 'cash' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="pos-tendered" className="shrink-0 text-sm">
                Khách đưa
              </label>
              <input
                id="pos-tendered"
                value={form.tendered}
                onChange={(e) => onForm({ tendered: e.target.value })}
                onBlur={() => form.tendered && onForm({ tendered: moneyInput(form.tendered).toLocaleString('vi-VN') })}
                inputMode="numeric"
                placeholder="0"
                className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-paper px-3 text-right tabular"
              />
            </div>
            {!empty && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh tiền khách đưa">
                {cashSuggestions(total).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onForm({ tendered: v.toLocaleString('vi-VN') })}
                    className="min-h-9 rounded-full border border-line bg-paper px-3 text-sm tabular hover:border-ink"
                  >
                    {v === total ? 'Đủ tiền' : formatVnd(v)}
                  </button>
                ))}
              </div>
            )}
            {change !== null && (
              <p className="flex items-baseline justify-between rounded-control bg-court-soft px-3 py-2 text-court-deep" aria-live="polite">
                <span className="text-sm">Tiền thối</span>
                <span className="font-display text-2xl tabular">{formatVnd(change)}</span>
              </p>
            )}
            {short > 0 && (
              <p className="text-sm text-shuttle-deep" aria-live="polite">
                Còn thiếu {formatVnd(short)}
              </p>
            )}
          </div>
        ) : (
          <input
            value={form.reference}
            onChange={(e) => onForm({ reference: e.target.value })}
            maxLength={100}
            placeholder="Mã giao dịch (không bắt buộc)"
            aria-label="Mã giao dịch"
            className="min-h-11 rounded-control border border-line bg-paper px-3"
          />
        )}

        {error && (
          <p role="alert" className="rounded-control bg-shuttle-soft px-3 py-2 text-sm text-shuttle-deep">
            {error}
          </p>
        )}
        <button type="submit" disabled={empty || isPending || short > 0} className={buttonClass('court', 'lg', 'w-full text-lg')}>
          {isPending ? 'Đang ghi đơn…' : empty ? 'Chưa có món' : `Thu ${formatVnd(total)}`}
        </button>
        <p className="hidden text-center text-xs text-muted [@media(pointer:fine)]:block">Ctrl + Enter để thu tiền. Phím / để tìm món.</p>
      </form>
    </section>
  );
}
