import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { ActionButton } from '@/components/ui/action-button';
import { Badge, DescriptionList, PageHeader, Panel } from '@/components/ui/primitives';
import { checkInBookingAction } from '@/features/admin-bookings/actions';
import { getBookingDetail } from '@/features/admin-bookings/queries';
import { CheckoutTerminal } from '@/features/checkout/components/checkout-terminal';
import { ExtendPlayPanel } from '@/features/checkout/components/extend-play-panel';
import { getExtendOptions } from '@/features/checkout/queries';
import { accountForBranch } from '@/features/payments/lib/transfer';
import { getBankAccounts } from '@/features/payments/queries';
import { requireStaff, withGuard } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';
import { formatDate, formatMinutes, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { BOOKING_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import { requestNow } from '@/lib/time';

export const metadata = { title: 'Thu tiền sân' };

const snapshotSchema = z.array(z.object({ price_per_hour: z.number(), minutes: z.number(), amount: z.number() }));

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [ctx, [data, accounts, extend]] = await withGuard(requireStaff(), () =>
    Promise.all([getBookingDetail(id), getBankAccounts(), getExtendOptions(id)]),
  );
  if (!data) notFound();
  const { booking: b, range, payments, balance } = data;
  if (!isOwner(ctx) && !hasPermission(ctx, 'payment.record', b.branch_id)) redirect('/admin/denied');
  const tz = b.courts?.branches?.timezone ?? 'Asia/Ho_Chi_Minh';
  const status = BOOKING_STATUS[b.status];
  const snapshot = snapshotSchema.safeParse(b.price_snapshot);
  const paid = (balance?.paid_amount ?? 0) - (balance?.refunded_amount ?? 0);
  const due = Math.max(0, balance?.balance_due ?? b.total_amount ?? 0);
  const canCheckIn = b.status === 'confirmed' && hasPermission(ctx, 'booking.operate', b.branch_id);

  return (
    <>
      <PageHeader
        title={`Thu tiền ${b.code}`}
        back={
          <Link href="/admin/checkout" className="text-sm text-muted hover:underline">
            Thu tiền sân
          </Link>
        }
        actions={
          <Badge tone={status.tone} className="px-3 py-1 text-sm">
            {status.label}
          </Badge>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          {extend && <ExtendPlayPanel data={extend} tz={tz} nowMs={requestNow()} />}
          <Panel title="Đơn đặt sân">
            <DescriptionList
              items={[
                { label: 'Khách', value: b.contact_name ?? b.customers?.full_name ?? '—' },
                { label: 'Điện thoại', value: b.customers?.phone ? formatPhone(b.customers.phone) : '—' },
                { label: 'Sân', value: `${b.courts?.name ?? ''}, ${b.courts?.branches?.name ?? ''}` },
                {
                  label: 'Giờ chơi',
                  value: range ? `${formatTime(range.start, tz)}–${formatTime(range.end, tz)}, ${formatDate(range.start, tz)}` : '—',
                },
              ]}
            />
            {snapshot.success && snapshot.data.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm">
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
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
              {b.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted">Giảm giá</dt>
                  <dd className="tabular">− {formatVnd(b.discount_amount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="font-medium">Tổng tiền sân</dt>
                <dd className="font-display text-xl tabular">{formatVnd(b.total_amount)}</dd>
              </div>
            </dl>
            {canCheckIn && (
              <div className="mt-4">
                <ActionButton action={checkInBookingAction.bind(null, b.id)} label="Khách đã đến — nhận sân" variant="outline" size="md" />
              </div>
            )}
          </Panel>
          {payments.length > 0 && (
            <Panel title="Đã thu">
              <ul className="divide-y divide-line">
                {payments
                  .filter((p) => p.status === 'succeeded')
                  .map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-2 text-sm">
                      <span>
                        {p.kind === 'refund' ? 'Hoàn tiền · ' : ''}
                        {PAYMENT_METHOD[p.method]}
                      </span>
                      <span className="tabular">{formatVnd(p.amount)}</span>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="order-1 lg:sticky lg:top-4 lg:order-2">
          <CheckoutTerminal
            key={`${b.total_amount}-${due}`}
            bookingId={b.id}
            bookingCode={b.code}
            initial={{ total: b.total_amount ?? 0, paid, due }}
            account={accountForBranch(accounts, b.branch_id)}
          />
        </div>
      </div>
    </>
  );
}
