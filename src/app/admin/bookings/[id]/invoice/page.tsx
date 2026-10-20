import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { buttonClass } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { getBookingDetail } from '@/features/admin-bookings/queries';
import { getBrandInfo } from '@/features/brand/queries';
import { requireStaff, withGuard } from '@/lib/auth/guards';
import { formatDate, formatDateTime, formatMinutes, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { PAYMENT_METHOD } from '@/lib/labels';

export const metadata = { title: 'Hóa đơn tiền sân' };

const snapshotSchema = z.array(z.object({ price_per_hour: z.number(), minutes: z.number(), amount: z.number() }));

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-3 text-base font-bold' : 'flex justify-between gap-3'}>
      <span>{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular">{value}</span>
    </div>
  );
}

/** Hóa đơn tiền sân khổ 80mm (in nhiệt) — nhân viên in sau khi thu tiền. RLS: chỉ người xem được đơn. */
export default async function BookingInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [ctx, [data, brand]] = await withGuard(requireStaff(), () => Promise.all([getBookingDetail(id), getBrandInfo()]));
  if (!data) notFound();
  const { booking: b, range, payments, balance } = data;
  const tz = b.courts?.branches?.timezone ?? 'Asia/Ho_Chi_Minh';
  const snapshot = snapshotSchema.safeParse(b.price_snapshot);
  const succeeded = payments.filter((p) => p.status === 'succeeded');
  const paid = (balance?.paid_amount ?? 0) - (balance?.refunded_amount ?? 0);
  const due = Math.max(0, balance?.balance_due ?? 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print-hide flex w-full max-w-sm flex-wrap justify-between gap-2">
        <Link href={`/admin/checkout/${b.id}`} className={buttonClass('outline')}>
          Quay lại
        </Link>
        <PrintButton label="In hóa đơn" auto />
      </div>
      <article className="print-sheet w-full max-w-sm rounded-panel border border-line bg-paper p-5 font-mono text-[13px] leading-snug text-ink">
        <header className="text-center">
          <p className="text-base font-bold uppercase">{brand.name}</p>
          {b.courts?.branches?.name && <p>{b.courts.branches.name}</p>}
          {brand.addressLine && <p>{brand.addressLine}</p>}
          {brand.hotline && <p>ĐT: {brand.hotline}</p>}
          <p className="mt-3 text-base font-bold">HÓA ĐƠN TIỀN SÂN</p>
          <p>Số: {b.code}</p>
          <p>{formatDateTime(new Date(), tz)}</p>
        </header>
        <hr className="my-3 border-dashed border-ink/50" />
        <div className="flex flex-col gap-0.5">
          <Line label="Khách" value={b.contact_name ?? b.customers?.full_name ?? 'Khách lẻ'} />
          {b.customers?.phone && <Line label="Điện thoại" value={formatPhone(b.customers.phone)} />}
          <Line label="Sân" value={b.courts?.name ?? ''} />
          {range && <Line label="Ngày" value={formatDate(range.start, tz)} />}
          {range && <Line label="Giờ" value={`${formatTime(range.start, tz)}–${formatTime(range.end, tz)}`} />}
        </div>
        <hr className="my-3 border-dashed border-ink/50" />
        <div className="flex flex-col gap-0.5">
          {snapshot.success && snapshot.data.length > 0 ? (
            snapshot.data.map((l, i) => (
              <Line key={i} label={`${formatMinutes(l.minutes)} × ${formatVnd(l.price_per_hour)}`} value={formatVnd(l.amount)} />
            ))
          ) : (
            <Line label="Tiền sân" value={formatVnd((b.total_amount ?? 0) + b.discount_amount)} />
          )}
          {b.discount_amount > 0 && <Line label="Giảm giá" value={`-${formatVnd(b.discount_amount)}`} />}
          <Line label="TỔNG CỘNG" value={formatVnd(b.total_amount)} strong />
        </div>
        <hr className="my-3 border-dashed border-ink/50" />
        <div className="flex flex-col gap-0.5">
          {succeeded.map((p) => (
            <Line
              key={p.id}
              label={`${p.kind === 'refund' ? 'Hoàn · ' : ''}${PAYMENT_METHOD[p.method]} ${formatTime(p.received_at, tz)}`}
              value={`${p.kind === 'refund' ? '-' : ''}${formatVnd(p.amount)}`}
            />
          ))}
          <Line label="Đã thanh toán" value={formatVnd(paid)} strong />
          {due > 0 && <Line label="Còn nợ" value={formatVnd(due)} strong />}
        </div>
        <hr className="my-3 border-dashed border-ink/50" />
        <footer className="text-center">
          <p>{due > 0 ? 'Chưa thanh toán đủ' : 'Đã thanh toán đủ'}</p>
          <p>Thu ngân: {ctx.displayName}</p>
          <p className="mt-2">Cảm ơn quý khách — hẹn gặp lại!</p>
        </footer>
      </article>
    </div>
  );
}
