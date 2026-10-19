import { Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { recordRentalPaymentAction } from '@/features/admin-rentals/actions';
import { RentalLiveStatus, RentalReturnForm } from '@/features/admin-rentals/components/rental-return-panel';
import { initials } from '@/features/admin-rentals/lib/rental-status';
import { getRental } from '@/features/admin-rentals/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { formatDate, formatDateTime, formatPhone, formatRateLabel, formatTime, formatVnd } from '@/lib/format';
import { isUuid, newIdempotencyKey } from '@/lib/ids';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD, PAYMENT_STATUS, RENTAL_BILLING, RENTAL_STATUS, RENTAL_USAGE } from '@/lib/labels';
import { computeOvertime, describePolicy, formatSpan } from '@/lib/rental-fee';
import { requestNow } from '@/lib/time';

export const metadata = { title: 'Phiếu thuê' };

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBranchPermission('rental.operate');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getRental(id);
  if (!data) notFound();
  const { rental: r, lines, paid, due, balance, policy, dueAt, booking } = data;
  const tz = r.branches?.timezone;
  const isOut = r.status === 'out';
  const now = requestNow();
  const usage = RENTAL_USAGE[r.usage];
  const estimate = isOut ? computeOvertime(new Date(dueAt), now, r.quantity, policy).fee : 0;
  const reduced = r.status === 'returned' && r.late_fee < r.late_fee_auto;

  return (
    <>
      <PageHeader
        title={`Phiếu ${r.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={RENTAL_STATUS[r.status].tone}>{RENTAL_STATUS[r.status].label}</Badge>
            <Badge tone={usage.tone}>{usage.label}</Badge>
            <span>{RENTAL_BILLING[r.billing]}</span>
          </span>
        }
        back={
          <Link href="/admin/rentals" className="text-sm text-muted hover:underline">
            Cho thuê
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel className="@container">
            <div className="grid gap-6 @2xl:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-hall font-display text-xl">
                    {initials(r.customers?.full_name ?? '?')}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {r.customers ? (
                      <Link href={`/admin/customers/${r.customers.id}`} className="truncate text-lg font-medium hover:underline">
                        {r.customers.full_name}
                      </Link>
                    ) : (
                      <span className="text-lg font-medium">Khách</span>
                    )}
                    {r.customers?.phone && (
                      <a
                        href={`tel:${r.customers.phone}`}
                        className="inline-flex items-center gap-1 text-sm text-muted tabular hover:text-ink"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {formatPhone(r.customers.phone)}
                      </a>
                    )}
                  </span>
                </div>
                <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted">Đồ thuê</dt>
                  <dd className="font-medium">
                    {r.products?.name} <span className="text-muted tabular">× {r.quantity}</span>
                  </dd>
                  <dt className="text-muted">Gói</dt>
                  <dd>
                    {formatRateLabel(r.rate_label, r.duration_minutes)}, {formatVnd(r.unit_price)}/món
                  </dd>
                  {booking && (
                    <>
                      <dt className="text-muted">Sân</dt>
                      <dd>
                        <Link href={`/admin/bookings/${booking.id}`} className="underline underline-offset-4">
                          {booking.courtName}
                          {booking.range ? `, ${formatTime(booking.range.start, tz)}–${formatTime(booking.range.end, tz)}` : ''}
                        </Link>
                      </dd>
                    </>
                  )}
                  <dt className="text-muted">Cầm cọc</dt>
                  <dd className="flex items-center gap-1">
                    {r.collateral ? (
                      <>
                        <ShieldCheck className="size-4 text-court-deep" aria-hidden />
                        {r.collateral}
                      </>
                    ) : (
                      <span className="text-muted">Không</span>
                    )}
                  </dd>
                  {r.note && (
                    <>
                      <dt className="text-muted">Ghi chú</dt>
                      <dd className="break-words">{r.note}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <ol className="grid grid-cols-3 gap-2 text-sm">
                  <li className="flex flex-col rounded-control bg-hall/70 p-3">
                    <span className="text-xs text-muted">Giao lúc</span>
                    <span className="font-display text-xl tabular">{formatTime(r.starts_at, tz)}</span>
                    <span className="text-xs text-muted tabular">{formatDate(r.starts_at, tz).slice(0, 5)}</span>
                  </li>
                  <li className="flex flex-col rounded-control bg-hall/70 p-3">
                    <span className="text-xs text-muted">Hẹn trả</span>
                    <span className="font-display text-xl tabular">{formatTime(dueAt, tz)}</span>
                    <span className="text-xs text-muted tabular">{formatDate(dueAt, tz).slice(0, 5)}</span>
                  </li>
                  <li className="flex flex-col rounded-control bg-hall/70 p-3">
                    <span className="text-xs text-muted">{r.returned_at ? 'Đã trả' : 'Ân hạn đến'}</span>
                    <span className="font-display text-xl tabular">
                      {formatTime(r.returned_at ?? new Date(new Date(dueAt).getTime() + policy.graceMinutes * 60000), tz)}
                    </span>
                    <span className="text-xs text-muted tabular">
                      {formatDate(r.returned_at ?? new Date(new Date(dueAt).getTime() + policy.graceMinutes * 60000), tz).slice(0, 5)}
                    </span>
                  </li>
                </ol>
                {isOut ? (
                  <RentalLiveStatus startsAt={r.starts_at} dueAt={dueAt} quantity={r.quantity} policy={policy} serverNow={now} />
                ) : (
                  <p className="text-sm text-muted">
                    {r.late_minutes && r.late_minutes > 0
                      ? `Trả trễ ${formatSpan(r.late_minutes)}${r.late_fee_auto > 0 ? `, hệ thống tính ${formatVnd(r.late_fee_auto)}` : ' (trong ân hạn)'}.`
                      : 'Trả đúng hạn.'}
                    {r.returned_at ? ` Nhận lúc ${formatDateTime(r.returned_at, tz)}.` : ''}
                  </p>
                )}
                <p className="text-xs text-muted">Chính sách trễ: {describePolicy(policy, formatVnd)}.</p>
              </div>
            </div>
          </Panel>

          {isOut ? (
            <Panel
              id="nhan-tra"
              title="Nhận trả"
              description="Món hư hoặc mất không cộng lại vào kho. Phụ phí trễ do hệ thống tính tại lúc bấm nhận trả."
              className="scroll-mt-20"
            >
              <RentalReturnForm
                rentalId={r.id}
                lines={lines.map((l) => ({ id: l.id, variantId: l.variant_id, label: l.label, quantity: l.quantity }))}
                startsAt={r.starts_at}
                dueAt={dueAt}
                quantity={r.quantity}
                policy={policy}
                serverNow={now}
              />
            </Panel>
          ) : (
            <Panel title="Kết quả trả">
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{l.label}</span>
                    <span className="text-sm text-muted tabular">
                      Trả {l.returned_quantity}, hư {l.damaged_quantity}, mất {l.lost_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Tiền">
            <dl className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">
                  Tiền thuê{' '}
                  <span className="text-xs">
                    ({r.quantity} × {formatVnd(r.unit_price)})
                  </span>
                </dt>
                <dd className="tabular">{formatVnd(r.rental_fee)}</dd>
              </div>
              {isOut ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Phụ phí trễ (tạm tính)</dt>
                  <dd className={estimate > 0 ? 'text-shuttle-deep tabular' : 'text-muted tabular'}>{formatVnd(estimate)}</dd>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Phụ phí trễ</dt>
                    <dd className="tabular">{formatVnd(r.late_fee)}</dd>
                  </div>
                  {reduced && (
                    <p className="text-xs text-amber-deep">
                      Giảm từ {formatVnd(r.late_fee_auto)}
                      {r.late_fee_reason ? `: ${r.late_fee_reason}` : ''}
                    </p>
                  )}
                </div>
              )}
              {r.damage_fee > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Phí hư/mất</dt>
                  <dd className="tabular">{formatVnd(r.damage_fee)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Đã thu</dt>
                <dd className="tabular">{formatVnd(paid)}</dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-medium">Còn phải thu</dt>
                <dd className="font-display text-2xl tabular">{formatVnd(Math.max(0, balance + estimate))}</dd>
              </div>
              {isOut && estimate > 0 && <p className="text-xs text-muted">Gồm phụ phí tạm tính; số chính thức chốt khi nhận trả.</p>}
            </dl>
            {r.payments.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
                {r.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      {formatDateTime(p.created_at, tz)}, {PAYMENT_METHOD[p.method]}
                      {p.note && <span className="block text-xs text-muted">{p.note}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular">{formatVnd(p.amount)}</span>
                      <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {balance > 0 && r.status !== 'voided' && (
            <Panel title="Thu tiền">
              <ActionForm action={recordRentalPaymentAction.bind(null, r.id)}>
                <input type="hidden" name="idempotency_key" value={newIdempotencyKey()} />
                <TextField name="amount" label="Số tiền (đ)" inputMode="numeric" defaultValue={balance} required />
                <SelectField
                  name="method"
                  label="Hình thức"
                  defaultValue="cash"
                  options={MANUAL_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))}
                />
                <TextField name="reference" label="Mã giao dịch" optional />
                <SubmitButton>Ghi nhận thanh toán</SubmitButton>
              </ActionForm>
            </Panel>
          )}
          {isOut && balance <= 0 && <p className="text-sm text-muted">Đã thu đủ tiền thuê. Phụ phí trễ (nếu có) thu sau khi nhận trả.</p>}
          {due === 0 && <p className="text-sm text-muted">Phiếu 0đ.</p>}
        </div>
      </div>
    </>
  );
}
