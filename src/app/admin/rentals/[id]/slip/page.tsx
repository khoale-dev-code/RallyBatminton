import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonClass } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { getRental } from '@/features/admin-rentals/queries';
import { getBrandInfo } from '@/features/brand/queries';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { formatDateTime, formatPhone, formatRateLabel, formatVnd } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { PAYMENT_METHOD, RENTAL_STATUS, RENTAL_USAGE } from '@/lib/labels';
import { describePolicy } from '@/lib/rental-fee';

export const metadata = { title: 'In phiếu cho thuê' };

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-3 text-base font-bold' : 'flex justify-between gap-3'}>
      <span>{label}</span>
      <span className="text-right whitespace-nowrap tabular">{value}</span>
    </div>
  );
}

/** Phiếu cho thuê khổ 80mm (in nhiệt) — tùy chọn, để giao khách giữ hoặc kẹp cùng vật cầm cọc. */
export default async function RentalSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ ctx }, [data, brand]] = await withGuard(requireBranchPermission('rental.operate'), () =>
    Promise.all([getRental(id), getBrandInfo()]),
  );
  if (!data) notFound();
  const { rental: r, lines, paid, due, policy, dueAt, booking } = data;
  const tz = r.branches?.timezone;
  const payments = r.payments.filter((p) => p.status === 'succeeded');

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print-hide flex w-full max-w-sm flex-wrap justify-between gap-2">
        <Link href={`/admin/rentals/${r.id}`} className={buttonClass('outline')}>
          Quay lại
        </Link>
        <PrintButton label="In phiếu" auto />
      </div>
      <article className="print-sheet w-full max-w-sm rounded-panel border border-line bg-paper p-5 font-mono text-[13px] leading-snug text-ink">
        <header className="text-center">
          <p className="text-base font-bold uppercase">{brand.name}</p>
          {r.branches?.name && <p>{r.branches.name}</p>}
          {brand.hotline && <p>ĐT: {brand.hotline}</p>}
          <p className="mt-3 text-base font-bold">PHIẾU CHO THUÊ</p>
          <p>Số: {r.code}</p>
          <p>
            {RENTAL_STATUS[r.status].label} · {RENTAL_USAGE[r.usage].label}
          </p>
        </header>
        <hr className="my-3 border-dashed border-ink/50" />
        <div className="flex flex-col gap-0.5">
          <Line label="Khách" value={r.customers?.full_name ?? 'Khách lẻ'} />
          {r.customers?.phone && <Line label="Điện thoại" value={formatPhone(r.customers.phone)} />}
          {booking && <Line label="Theo lượt đặt sân" value={`${booking.code} · ${booking.courtName}`} />}
          <Line label="Nhận lúc" value={formatDateTime(r.starts_at, tz)} />
          <Line label="Hạn trả" value={formatDateTime(dueAt, tz)} />
          {r.returned_at && <Line label="Đã trả lúc" value={formatDateTime(r.returned_at, tz)} />}
        </div>
        <hr className="my-3 border-dashed border-ink/50" />
        <p className="font-bold">
          {r.products?.name} × {r.quantity}
        </p>
        <p>
          {formatRateLabel(r.rate_label, r.duration_minutes)} · {formatVnd(r.unit_price)}/món
        </p>
        {lines.length > 0 && (
          <ul className="mt-1">
            {lines.map((l) => (
              <li key={l.id}>
                – {l.label} × {l.quantity}
              </li>
            ))}
          </ul>
        )}
        {r.collateral && <p className="mt-1">Cầm cọc: {r.collateral}</p>}
        <hr className="my-3 border-dashed border-ink/50" />
        <div className="flex flex-col gap-0.5">
          <Line label="Tiền thuê" value={formatVnd(r.rental_fee ?? r.unit_price * r.quantity)} />
          {r.late_fee > 0 && <Line label="Phụ phí trả trễ" value={formatVnd(r.late_fee)} />}
          {r.damage_fee > 0 && <Line label="Hư hỏng / mất" value={formatVnd(r.damage_fee)} />}
          <Line label="TỔNG" value={formatVnd(due)} strong />
          {payments.map((p) => (
            <Line key={p.id} label={`${p.kind === 'refund' ? 'Hoàn · ' : ''}${PAYMENT_METHOD[p.method]}`} value={formatVnd(p.amount)} />
          ))}
          <Line label="Đã thanh toán" value={formatVnd(paid)} />
          {due - paid > 0 && <Line label="Còn phải trả" value={formatVnd(due - paid)} strong />}
        </div>
        <hr className="my-3 border-dashed border-ink/50" />
        <p className="text-[12px]">Trả trễ: {describePolicy(policy, formatVnd)}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-center text-[12px]">
          <div>
            <p>Khách hàng</p>
            <p className="mt-10">(ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p>Nhân viên</p>
            <p className="mt-10">{ctx.displayName}</p>
          </div>
        </div>
        <p className="mt-4 text-center">Vui lòng giữ phiếu và trả đồ đúng hạn. Cảm ơn quý khách!</p>
      </article>
    </div>
  );
}
