'use client';

import { Luggage, MapPin, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ActionForm, CheckboxField, FieldError, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { StepperInput } from '@/components/ui/stepper-input';
import { cn } from '@/lib/cn';
import { formatPhone, formatRateLabel, formatTime, formatVnd } from '@/lib/format';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD, RENTAL_USAGE } from '@/lib/labels';
import { describePolicy, formatSpan, type RentalUsage } from '@/lib/rental-fee';

import { checkoutRentalAction } from '../actions';
import { useNow } from '../hooks/use-now';
import { type ActiveBookingOption, type RentalOption } from '../types';

const COLLATERAL_PRESETS = ['CCCD', 'Bằng lái xe', 'Thẻ sinh viên', 'Cọc 500.000 ₫'];

function Step({ n, title, hint, children }: { n: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line pb-5 last:border-0 last:pb-0">
      <header className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-display text-sm text-paper">{n}</span>
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-lg leading-tight">{title}</span>
          {hint && <span className="text-sm text-muted">{hint}</span>}
        </span>
      </header>
      <div className="flex flex-col gap-3 sm:pl-10">{children}</div>
    </section>
  );
}

/**
 * Phiếu thuê tại quầy: hình thức (tại sân / mang về) → món → gói giá → (gắn sân) → khách → cọc → thu tiền.
 * Giá, tồn kho, hạn trả và chính sách phụ phí đều được database kiểm lại và chụp vào phiếu.
 */
export function RentalCheckoutForm({
  options,
  bookings,
  idempotencyKey,
  serverNow,
}: {
  options: RentalOption[];
  bookings: ActiveBookingOption[];
  idempotencyKey: string;
  serverNow: number;
}) {
  const now = useNow(serverNow);
  const hasTakeOut = options.some((o) => o.rates.some((r) => r.usage === 'take_out'));
  const [usage, setUsage] = useState<RentalUsage>('on_site');
  const forUsage = options.filter((o) => o.rates.some((r) => r.usage === usage));
  const [productId, setProductId] = useState(forUsage[0]?.productId ?? '');
  const [variantId, setVariantId] = useState('');
  const [rateId, setRateId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [bookingId, setBookingId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [collateral, setCollateral] = useState('');
  const [collect, setCollect] = useState(true);

  const product = forUsage.find((o) => o.productId === productId) ?? forUsage[0];
  const rates = product?.rates.filter((r) => r.usage === usage) ?? [];
  const rate = rates.find((r) => r.id === rateId) ?? rates[0];
  const variant = product?.variants.find((v) => v.id === variantId) ?? (product?.variants.length === 1 ? product.variants[0] : undefined);
  const available = product?.isBundle ? (product.bundleAvailable ?? 0) : (variant?.onHand ?? null);
  const maxQty = Math.max(1, Math.min(50, available ?? 50));
  const booking = usage === 'on_site' ? bookings.find((b) => b.id === bookingId) : undefined;
  const fee = rate ? rate.price * quantity : 0;

  const dueAt =
    rate?.billing === 'session' && booking
      ? new Date(Math.max(new Date(booking.endsAt).getTime(), now + 15 * 60000))
      : new Date(now + (rate?.durationMinutes ?? 0) * 60000);

  function chooseUsage(next: RentalUsage) {
    setUsage(next);
    const first = options.find((o) => o.rates.some((r) => r.usage === next));
    setProductId(first?.productId ?? '');
    setVariantId('');
    setRateId('');
    if (next === 'take_out') setBookingId('');
  }

  function chooseBooking(id: string) {
    const prev = bookings.find((b) => b.id === bookingId);
    const next = bookings.find((b) => b.id === id);
    setBookingId(id);
    // Điền khách theo lượt đặt nếu ô đang trống hoặc đang là khách của lượt đặt trước.
    if (next && (phone === '' || phone === prev?.customerPhone)) {
      setPhone(next.customerPhone);
      setName(next.customerName);
    }
  }

  return (
    <ActionForm action={checkoutRentalAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="rate_id" value={rate?.id ?? ''} />
      <input type="hidden" name="booking_id" value={booking?.id ?? ''} />

      <div className="flex min-w-0 flex-col gap-5 rounded-panel border border-line bg-paper p-4 sm:p-6">
        <Step n={1} title="Hình thức thuê" hint="Giá tại sân và mang ra ngoài khác nhau.">
          <div role="radiogroup" aria-label="Hình thức thuê" className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'on_site', icon: MapPin, sub: 'Dùng trong sân, trả tại quầy' },
                { id: 'take_out', icon: Luggage, sub: 'Mang về, cần cầm cọc' },
              ] as const
            ).map((o) => {
              const disabled = o.id === 'take_out' && !hasTakeOut;
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={usage === o.id}
                  disabled={disabled}
                  onClick={() => chooseUsage(o.id)}
                  className={cn(
                    'flex min-h-16 items-start gap-3 rounded-control border p-3 text-left transition-colors disabled:opacity-40',
                    usage === o.id ? 'border-ink bg-ink text-paper' : 'border-line hover:bg-hall',
                  )}
                >
                  <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{RENTAL_USAGE[o.id].label}</span>
                    <span className={cn('text-xs', usage === o.id ? 'text-paper/75' : 'text-muted')}>
                      {disabled ? 'Chưa có gói mang về' : o.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={2} title="Đồ cho thuê">
          {forUsage.length === 0 ? (
            <p className="text-sm text-muted">Chưa có món nào có gói giá cho hình thức này.</p>
          ) : (
            <>
              <SelectField
                name="product_id"
                label="Món"
                value={product?.productId ?? ''}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setVariantId('');
                  setRateId('');
                  setQuantity(1);
                }}
                options={forUsage.map((o) => ({ value: o.productId, label: o.isBundle ? `${o.name} (combo)` : o.name }))}
              />
              {product && !product.isBundle && product.variants.length > 1 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Size / loại</span>
                  <div role="radiogroup" aria-label="Size / loại" className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={variant?.id === v.id}
                        disabled={v.onHand <= 0}
                        onClick={() => {
                          setVariantId(v.id);
                          setQuantity((q) => Math.min(q, Math.max(1, v.onHand)));
                        }}
                        className={cn(
                          'flex min-h-11 flex-col items-start rounded-control border px-3 py-1.5 text-left disabled:opacity-40',
                          variant?.id === v.id ? 'border-ink bg-hall' : 'border-line hover:bg-hall/60',
                        )}
                      >
                        <span className="font-medium">{v.label}</span>
                        <span className="text-xs text-muted">còn {v.onHand}</span>
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="variant_id" value={variant?.id ?? ''} />
                  <FieldError name="variant_id" />
                </div>
              )}
              {product && !product.isBundle && product.variants.length === 1 && variant && (
                <input type="hidden" name="variant_id" value={variant.id} />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Số lượng</span>
                  {available !== null && <span className="text-xs text-muted">Còn {available} tại chi nhánh</span>}
                </span>
                <StepperInput label="số lượng" value={quantity} onChange={setQuantity} min={1} max={maxQty} />
              </div>
            </>
          )}
        </Step>

        <Step n={3} title="Gói giá" hint={rate ? describePolicy(rate.policy, formatVnd) : undefined}>
          {rates.length === 0 ? (
            <p className="text-sm text-muted">Món này chưa có gói giá cho hình thức đã chọn.</p>
          ) : (
            <div role="radiogroup" aria-label="Gói giá" className="grid gap-2 sm:grid-cols-2">
              {rates.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={rate?.id === r.id}
                  onClick={() => setRateId(r.id)}
                  className={cn(
                    'flex min-h-16 items-center justify-between gap-3 rounded-control border p-3 text-left transition-colors',
                    rate?.id === r.id ? 'border-court-deep bg-court-soft' : 'border-line hover:bg-hall/60',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{r.billing === 'session' ? r.label : formatRateLabel(r.label, r.durationMinutes)}</span>
                    <span className="text-xs text-muted">
                      {r.billing === 'session' ? 'Trả khi kết thúc giờ sân' : `Trả sau ${formatSpan(r.durationMinutes)}`}
                    </span>
                  </span>
                  <span className="font-display text-xl whitespace-nowrap tabular">{formatVnd(r.price)}</span>
                </button>
              ))}
            </div>
          )}
        </Step>

        {usage === 'on_site' && (
          <Step
            n={4}
            title="Gắn lượt đặt sân"
            hint={
              rate?.billing === 'session'
                ? 'Gói hết trận: hạn trả = giờ kết thúc sân. Không gắn sân thì tính theo thời lượng dự kiến.'
                : 'Không bắt buộc — giúp biết đồ đang ở sân nào.'
            }
          >
            {bookings.length === 0 ? (
              <p className="text-sm text-muted">Không có lượt đặt sân nào đang chơi hoặc sắp vào trong 60 phút.</p>
            ) : (
              <SelectField
                name="booking_pick"
                label="Lượt đặt"
                value={bookingId}
                onChange={(e) => chooseBooking(e.target.value)}
                placeholder="Không gắn sân (khách vãng lai)"
                options={bookings.map((b) => ({
                  value: b.id,
                  label: `${b.courtName} · ${formatTime(b.startsAt)}–${formatTime(b.endsAt)} · ${b.customerName}${b.checkedIn ? ' (đang chơi)' : ''}`,
                }))}
              />
            )}
          </Step>
        )}

        <Step n={usage === 'on_site' ? 5 : 4} title="Khách thuê" hint={booking ? 'Để trống để dùng khách của lượt đặt sân.' : undefined}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              name="customer_phone"
              label="Số điện thoại"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901 234 567"
            />
            <TextField name="customer_name" label="Tên khách" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {usage === 'take_out' && (
            <div className="flex flex-col gap-2">
              <TextField
                name="collateral"
                label="Vật cầm cọc"
                hint="Bắt buộc khi mang ra ngoài. Chỉ ghi LOẠI giấy tờ (vd. CCCD) — không ghi số giấy tờ."
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                maxLength={120}
                required
              />
              <div className="flex flex-wrap gap-2">
                {COLLATERAL_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCollateral(c)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm',
                      collateral === c ? 'border-court-deep bg-court-soft text-court-deep' : 'border-line hover:bg-hall',
                    )}
                  >
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          <TextareaField name="note" label="Ghi chú" optional rows={2} placeholder="Vợt căng 24 lbs, khách tự mang cầu…" />
        </Step>
      </div>

      <aside className="flex flex-col gap-4 rounded-panel border border-line bg-paper p-4 sm:p-5 lg:sticky lg:top-20">
        <h2 className="font-display text-xl">Phiếu thuê</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Món</dt>
            <dd className="text-right font-medium">
              {product?.name ?? '—'} <span className="text-muted tabular">× {quantity}</span>
            </dd>
          </div>
          {variant && product && product.variants.length > 1 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Size</dt>
              <dd className="text-right">{variant.label}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Hình thức</dt>
            <dd className="text-right">
              {RENTAL_USAGE[usage].short}
              {booking ? ` · ${booking.courtName}` : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Gói</dt>
            <dd className="text-right">{rate ? `${rate.label}, ${formatVnd(rate.price)}/món` : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Hẹn trả</dt>
            <dd className="text-right font-medium tabular">
              {rate ? formatTime(dueAt) : '—'}
              {rate && dueAt.getTime() - now >= 86400000 ? ` (+${Math.floor((dueAt.getTime() - now) / 86400000)} ngày)` : ''}
            </dd>
          </div>
          {booking && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Khách sân</dt>
              <dd className="text-right">
                {booking.customerName}
                {booking.customerPhone ? `, ${formatPhone(booking.customerPhone)}` : ''}
              </dd>
            </div>
          )}
        </dl>
        {rate && (
          <p className="rounded-control bg-hall/70 px-3 py-2 text-xs text-muted">Trả trễ: {describePolicy(rate.policy, formatVnd)}.</p>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-muted">Tiền thuê</span>
          <span className="font-display text-3xl tabular">{formatVnd(fee)}</span>
        </div>
        <CheckboxField name="collect_payment" label="Thu tiền ngay" checked={collect} onChange={(e) => setCollect(e.target.checked)} />
        {collect ? (
          <>
            <SelectField
              name="payment_method"
              label="Hình thức"
              defaultValue="cash"
              options={MANUAL_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))}
            />
            <TextField name="payment_reference" label="Mã giao dịch" optional maxLength={100} />
          </>
        ) : (
          <input type="hidden" name="payment_method" value="cash" />
        )}
        <SubmitButton pendingLabel="Đang tạo phiếu…" variant="court" className="w-full">
          Giao đồ và tạo phiếu
        </SubmitButton>
      </aside>
    </ActionForm>
  );
}
