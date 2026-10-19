import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Countdown } from '@/components/ui/interactive';
import { Badge, DescriptionList, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import {
  cancelBookingAction,
  checkInBookingAction,
  confirmBookingAction,
  markNoShowAction,
  recordPaymentAction,
  recordRefundAction,
  rescheduleBookingAction,
  voidPaymentAction,
} from '@/features/admin-bookings/actions';
import { getBookingDetail } from '@/features/admin-bookings/queries';
import { requireStaff } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';
import { formatDate, formatDateTime, formatMinutes, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_SOURCE, BOOKING_STATUS, MANUAL_PAYMENT_METHODS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/labels';
import { halfHourOptions } from '@/lib/options';
import { newIdempotencyKey } from '@/lib/ids';
import { dateKeyInZone, timeInZone, requestNow } from '@/lib/time';

const snapshotSchema = z.array(z.object({ price_per_hour: z.number(), minutes: z.number(), amount: z.number() }));

export const metadata = { title: 'Chi tiết đơn' };

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const data = await getBookingDetail(id);
  if (!data) notFound();
  const { booking: b, range, payments, balance, courts, audit } = data;
  const branchInfo = b.courts?.branches;
  const tz = branchInfo?.timezone ?? 'Asia/Ho_Chi_Minh';
  const owner = isOwner(ctx);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(ctx, p, b.branch_id);
  const status = BOOKING_STATUS[b.status];
  const snapshot = snapshotSchema.safeParse(b.price_snapshot);
  const paid = balance?.paid_amount ?? 0;
  const refunded = balance?.refunded_amount ?? 0;
  const due = balance?.balance_due ?? b.total_amount ?? 0;
  const netPaid = paid - refunded;
  const isCustomer = b.kind === 'customer';
  const active = b.status === 'held' || b.status === 'confirmed';
  const started = range ? range.start.getTime() <= requestNow() : false;
  const methodOptions = MANUAL_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }));
  const times = halfHourOptions(true);
  const dateKey = range ? dateKeyInZone(range.start, tz) : '';

  return (
    <>
      <PageHeader
        title={b.code}
        back={
          <Link href={`/admin/bookings${dateKey ? `?date=${dateKey}` : ''}`} className="text-sm text-muted hover:underline">
            Lịch đặt sân
          </Link>
        }
        actions={
          <Badge tone={status.tone} className="px-3 py-1 text-sm">
            {status.label}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={isCustomer ? 'Thông tin đơn' : 'Khóa sân'}>
            <DescriptionList
              items={[
                ...(isCustomer
                  ? [
                      { label: 'Khách', value: b.contact_name ?? b.customers?.full_name ?? '—' },
                      {
                        label: 'Điện thoại',
                        value: b.customers?.phone ? (
                          <a href={`tel:${b.customers.phone}`} className="underline underline-offset-4">
                            {formatPhone(b.customers.phone)}
                          </a>
                        ) : (
                          '—'
                        ),
                      },
                    ]
                  : [{ label: 'Lý do', value: b.internal_note ?? '—' }]),
                { label: 'Sân', value: `${b.courts?.name ?? ''}, ${branchInfo?.name ?? ''}` },
                {
                  label: 'Thời gian',
                  value: range ? `${formatTime(range.start, tz)}–${formatTime(range.end, tz)}, ${formatDate(range.start, tz)}` : '—',
                },
                { label: 'Nguồn', value: BOOKING_SOURCE[b.source] },
                { label: 'Tạo lúc', value: formatDateTime(b.created_at, tz) },
                ...(b.customer_note ? [{ label: 'Ghi chú của khách', value: b.customer_note }] : []),
                ...(isCustomer && b.internal_note ? [{ label: 'Ghi chú nội bộ', value: b.internal_note }] : []),
                ...(b.status_reason ? [{ label: 'Lý do hủy/không đến', value: b.status_reason }] : []),
                ...(b.refund_entitlement !== null ? [{ label: 'Được hoàn theo chính sách', value: formatVnd(b.refund_entitlement) }] : []),
              ]}
            />
          </Panel>

          {isCustomer && (
            <Panel title="Tiền">
              {snapshot.success && snapshot.data.length > 0 && (
                <ul className="mb-4 flex flex-col gap-1 text-sm">
                  {snapshot.data.map((line, i) => (
                    <li key={i} className="flex justify-between gap-3 text-muted">
                      <span>
                        {formatMinutes(line.minutes)} × {formatVnd(line.price_per_hour)}/giờ
                      </span>
                      <span className="tabular">{formatVnd(line.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted">Tổng</dt>
                  <dd className="font-display text-xl whitespace-nowrap tabular sm:text-2xl">{formatVnd(b.total_amount)}</dd>
                  {b.discount_amount > 0 && <dd className="text-xs text-muted">đã giảm {formatVnd(b.discount_amount)}</dd>}
                </div>
                <div>
                  <dt className="text-sm text-muted">Cọc yêu cầu</dt>
                  <dd className="font-display text-xl whitespace-nowrap tabular sm:text-2xl">{formatVnd(b.deposit_amount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Đã thu</dt>
                  <dd className="font-display text-xl whitespace-nowrap tabular sm:text-2xl">{formatVnd(netPaid)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Còn lại</dt>
                  <dd className="font-display text-xl whitespace-nowrap tabular sm:text-2xl">{formatVnd(due)}</dd>
                </div>
              </dl>
              {payments.length > 0 && (
                <ul className="mt-5 divide-y divide-line border-t border-line">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">
                          {p.kind === 'refund' ? 'Hoàn ' : ''}
                          {formatVnd(p.amount)}, {PAYMENT_METHOD[p.method]}
                          {p.reference ? <span className="text-muted"> ({p.reference})</span> : null}
                        </p>
                        <p className="text-sm text-muted">
                          {formatDateTime(p.received_at, tz)}
                          {p.note ? `, ${p.note}` : ''}
                          {p.void_reason ? `, hủy: ${p.void_reason}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                        {owner && p.status === 'succeeded' && (
                          <Disclosure summary="Hủy giao dịch" tone="danger">
                            <ActionForm action={voidPaymentAction.bind(null, p.id, b.id)}>
                              <TextField name="reason" label="Lý do hủy" required />
                              <SubmitButton variant="danger" size="sm">
                                Hủy giao dịch
                              </SubmitButton>
                            </ActionForm>
                          </Disclosure>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {owner && audit.length > 0 && (
            <Panel title="Lịch sử thay đổi">
              <ol className="flex flex-col gap-2 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-x-3">
                    <span className="text-muted tabular">{formatDateTime(a.occurred_at, tz)}</span>
                    <span>{a.action === 'INSERT' ? 'Tạo đơn' : (a.reason ?? 'Cập nhật')}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>

        {/* Màn hình hẹp: thao tác chính (xác nhận, khách đến, thu tiền) lên đầu trang. */}
        <div className="order-first flex min-w-0 flex-col gap-4 xl:order-none">
          {b.status === 'held' && b.hold_expires_at && (
            <Panel>
              <p className="text-sm text-muted">Giữ chỗ hết hạn sau</p>
              <Countdown until={b.hold_expires_at} className="font-display text-4xl text-shuttle-deep" />
              {can('booking.confirm') && (
                <div className="mt-4">
                  <ActionButton
                    action={confirmBookingAction.bind(null, b.id)}
                    label="Xác nhận đơn"
                    variant="court"
                    size="lg"
                    pendingLabel="Đang xác nhận…"
                  />
                </div>
              )}
            </Panel>
          )}

          {b.status === 'confirmed' && isCustomer && can('booking.operate') && (
            <Panel>
              <ActionButton action={checkInBookingAction.bind(null, b.id)} label="Khách đã đến sân" variant="primary" size="lg" />
            </Panel>
          )}

          {isCustomer && can('payment.record') && ['held', 'confirmed', 'checked_in', 'completed'].includes(b.status) && due > 0 && (
            <Disclosure summary="Ghi nhận tiền thu" defaultOpen={b.status !== 'held'}>
              <ActionForm action={recordPaymentAction.bind(null, b.id)}>
                <input type="hidden" name="idempotency_key" value={newIdempotencyKey()} />
                <TextField
                  name="amount"
                  label="Số tiền (₫)"
                  inputMode="numeric"
                  defaultValue={String(netPaid < b.deposit_amount ? b.deposit_amount - netPaid : due)}
                  required
                />
                <SelectField name="method" label="Hình thức" options={methodOptions} defaultValue="cash" />
                <TextField name="reference" label="Mã giao dịch" optional hint="Bắt buộc với chuyển khoản, thẻ, ví." />
                <TextField name="note" label="Ghi chú" optional />
                <SubmitButton pendingLabel="Đang ghi…">Ghi nhận tiền</SubmitButton>
              </ActionForm>
            </Disclosure>
          )}

          {active && isCustomer && can('booking.operate') && courts.length > 0 && (
            <Disclosure summary="Đổi giờ / đổi sân">
              <ActionForm action={rescheduleBookingAction.bind(null, b.id)}>
                <SelectField
                  name="court_id"
                  label="Sân"
                  options={courts.map((c) => ({ value: c.id, label: c.name }))}
                  defaultValue={b.court_id}
                />
                <TextField name="date" label="Ngày" type="date" defaultValue={dateKey} required />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField name="start" label="Từ" options={times} defaultValue={range ? timeInZone(range.start, tz) : undefined} />
                  <SelectField name="end" label="Đến" options={times} defaultValue={range ? timeInZone(range.end, tz) : undefined} />
                </div>
                <TextField name="reason" label="Lý do" required />
                <SubmitButton variant="outline" pendingLabel="Đang đổi…">
                  Đổi lịch
                </SubmitButton>
              </ActionForm>
            </Disclosure>
          )}

          {b.status === 'confirmed' && isCustomer && started && can('booking.operate') && (
            <Disclosure summary="Khách không đến">
              <ActionForm action={markNoShowAction.bind(null, b.id)}>
                <TextField name="reason" label="Ghi chú" defaultValue="Khách không đến, không báo trước" required />
                <SubmitButton variant="outline">Đánh dấu không đến</SubmitButton>
              </ActionForm>
            </Disclosure>
          )}

          {active && can('booking.operate') && (!started || owner) && (
            <Disclosure summary={isCustomer ? 'Hủy đơn' : 'Mở khóa sân'} tone="danger">
              <ActionForm action={cancelBookingAction.bind(null, b.id)} confirmMessage="Xác nhận hủy?">
                <TextField name="reason" label="Lý do" required />
                {owner && isCustomer && <CheckboxField name="waive" label="Miễn chính sách hủy (hoàn toàn bộ tiền đã thu)" />}
                <SubmitButton variant="danger">{isCustomer ? 'Hủy đơn' : 'Mở khóa'}</SubmitButton>
              </ActionForm>
            </Disclosure>
          )}

          {owner && isCustomer && netPaid > 0 && (
            <Disclosure summary="Ghi nhận hoàn tiền">
              <ActionForm action={recordRefundAction.bind(null, b.id)}>
                <input type="hidden" name="idempotency_key" value={newIdempotencyKey()} />
                <TextField
                  name="amount"
                  label="Số tiền hoàn (₫)"
                  inputMode="numeric"
                  defaultValue={String(b.refund_entitlement ?? netPaid)}
                  required
                />
                <SelectField name="method" label="Hình thức" options={methodOptions} defaultValue="bank_transfer" />
                <TextField name="reference" label="Mã giao dịch" optional />
                <TextField name="note" label="Lý do hoàn" required />
                <SubmitButton variant="outline">Ghi nhận hoàn tiền</SubmitButton>
              </ActionForm>
            </Disclosure>
          )}
        </div>
      </div>
    </>
  );
}
