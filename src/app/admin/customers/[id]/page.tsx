import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, CheckboxField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Badge, DescriptionList, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { updateCustomerAction } from '@/features/admin-customers/actions';
import { MemberTierBadge } from '@/features/admin-customers/components/member-tier-badge';
import { getCustomer } from '@/features/admin-customers/queries';
import { requireStaff, withGuard } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { formatDate, formatNumber, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_STATUS, RENTAL_STATUS } from '@/lib/labels';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ctx, data] = await withGuard(requireStaff(), () => getCustomer(id));
  if (!data) notFound();
  const { customer: c, member, bookings, rentals, sales, stats } = data;
  return (
    <>
      <PageHeader
        title={c.full_name}
        description={formatPhone(c.phone)}
        back={
          <Link href="/admin/customers" className="text-sm text-muted hover:underline">
            Khách hàng
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-panel border border-line bg-paper p-4 sm:p-5 lg:grid-cols-4">
        <Stat label="Tổng chi tiêu" value={formatVnd(stats.spent)} hint="Đặt sân, mua hàng, thuê đồ" />
        <Stat
          label="Đã chơi"
          value={`${stats.played} lượt`}
          hint={stats.noShow > 0 ? `${stats.noShow} lần không đến` : 'Chưa bỏ lịch lần nào'}
        />
        <Stat label="Hóa đơn mua hàng" value={sales.filter((x) => x.status === 'completed').length} />
        <Stat label="Lượt thuê đồ" value={rentals.length} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={`Lịch sử đặt sân (${bookings.length})`}>
            {bookings.length === 0 ? (
              <p className="text-muted">Chưa có đơn đặt sân bạn được xem.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-hall/60"
                    >
                      <span>
                        <span className="font-medium">{b.code}</span>
                        <span className="text-sm text-muted">
                          {' '}
                          {b.courts?.branches?.name}, {b.courts?.name}
                          {b.range ? `, ${formatTime(b.range.start)} ${formatDate(b.range.start)}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm tabular">{formatVnd(b.total_amount)}</span>
                        <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {sales.length > 0 && (
            <Panel title={`Hóa đơn mua hàng (${sales.length})`}>
              <ul className="divide-y divide-line">
                {sales.map((sale) => (
                  <li key={sale.id}>
                    <Link
                      href={`/admin/sales/${sale.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-hall/60"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{sale.code}</span>
                        <span className="text-sm text-muted">
                          {' '}
                          {sale.branches?.name}, {formatTime(sale.sold_at)} {formatDate(sale.sold_at)}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {sale.sale_lines.map((l) => `${l.quantity} × ${l.product_name}`).join(', ')}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm tabular">{formatVnd(sale.total_amount)}</span>
                        {sale.status === 'voided' ? <Badge tone="red">Đã hủy</Badge> : <Badge tone="green">Hoàn tất</Badge>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {rentals.length > 0 && (
            <Panel title={`Lượt thuê thiết bị (${rentals.length})`}>
              <ul className="divide-y divide-line">
                {rentals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/rentals/${r.id}`} className="flex justify-between gap-3 py-3 hover:bg-hall/60">
                      <span className="min-w-0">
                        {r.code}{' '}
                        <span className="text-sm text-muted">
                          {r.products?.name}, {formatDate(r.starts_at)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm tabular">{formatVnd((r.rental_fee ?? 0) + r.late_fee + r.damage_fee)}</span>
                        <Badge tone={RENTAL_STATUS[r.status].tone}>{RENTAL_STATUS[r.status].label}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Tài khoản thành viên">
            {member ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <MemberTierBadge tier={member.tier} />
                  {member.is_locked && <Badge tone="red">Đang khóa</Badge>}
                  <span className="text-sm text-muted">từ {formatDate(member.created_at)}</span>
                </div>
                <p className="font-display text-3xl tabular">
                  {formatNumber(member.points)} <span className="font-sans text-sm text-muted">điểm</span>
                </p>
                <Link href={`/admin/customers/members/${member.user_id}`} className="text-sm font-medium text-court-deep hover:underline">
                  Xem tài khoản thành viên →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">Khách vãng lai — chưa có tài khoản trên website.</p>
            )}
          </Panel>
          <Panel title="Thông tin">
            {isOwner(ctx) ? (
              <ActionForm action={updateCustomerAction.bind(null, c.id)}>
                <TextField name="full_name" label="Họ tên" defaultValue={c.full_name} required />
                <TextField name="email" label="Email" type="email" defaultValue={c.email ?? ''} optional />
                <TextareaField name="staff_note" label="Ghi chú nội bộ" defaultValue={c.staff_note ?? ''} optional />
                <CheckboxField name="marketing_opt_in" label="Đồng ý nhận tin khuyến mãi" defaultChecked={c.marketing_opt_in} />
                <SubmitButton size="sm">Lưu</SubmitButton>
              </ActionForm>
            ) : (
              <DescriptionList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Điện thoại', value: formatPhone(c.phone) },
                  { label: 'Ghi chú', value: c.staff_note ?? '—' },
                ]}
              />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
