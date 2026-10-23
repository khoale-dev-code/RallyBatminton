import { ArrowLeft, UserRound } from 'lucide-react';
import { initialsOf } from '@/features/member/lib/initials';
import '@/features/admin-customers/rally-customers-v15.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, CheckboxField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Badge, DescriptionList, Panel, Stat } from '@/components/ui/primitives';
import { updateCustomerAction } from '@/features/admin-customers/actions';
import { MemberTierBadge } from '@/features/admin-customers/components/member-tier-badge';
import { getCustomer } from '@/features/admin-customers/queries';
import { AnonymizePanel, ExportCustomerData } from '@/features/privacy/components/admin-privacy';
import { listConsents } from '@/features/privacy/queries';
import { HoldPolicyCard } from '@/features/security/components/hold-policy-card';
import { getCustomerHoldStatus } from '@/features/security/queries';
import { requireStaff, withGuard } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { formatDate, formatDateTime, formatNumber, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_STATUS, RENTAL_STATUS } from '@/lib/labels';

type CustomerBookingItem = NonNullable<Awaited<ReturnType<typeof getCustomer>>>['bookings'][number];

function BookingRow({ b }: { b: CustomerBookingItem }) {
  return (
<li>
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
  );
}

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { view: requestedView } = await searchParams;
  const view = requestedView === 'profile' ? 'profile' : 'activity';
  const [ctx, data] = await withGuard(requireStaff(), () => getCustomer(id));
  if (!data) notFound();
  const { customer: c, member, bookings, rentals, sales, stats } = data;
  const owner = isOwner(ctx);
  const [consents, holdStatus] = await Promise.all([
    owner && view === 'profile' ? listConsents({ customerId: c.id, userId: c.auth_user_id ?? undefined }, 10) : Promise.resolve(null),
    c.anonymized_at || view !== 'profile' ? Promise.resolve(null) : getCustomerHoldStatus(c.id),
  ]);
  return (
    <div className="rcm-page">
      <header className="rcm-profile-header">
        <span className="rcm-profile-avatar" aria-hidden>{initialsOf(c.full_name)}</span>
        <div className="min-w-0 flex-1">
          <Link href="/admin/customers" className="rcm-profile-back"><ArrowLeft size={14} aria-hidden /> Danh sách khách</Link>
          <h1>{c.full_name}</h1>
          <p>{c.anonymized_at ? `Đã ẩn danh hóa ngày ${formatDate(c.anonymized_at)}` : formatPhone(c.phone)}</p>
          <div className="rcm-profile-badges">
            {member ? <MemberTierBadge tier={member.tier} /> : <Badge>Khách vãng lai</Badge>}
            {member?.is_locked && <Badge tone="red">Thành viên đang khóa</Badge>}
          </div>
        </div>
        <UserRound size={28} aria-hidden className="opacity-40" />
      </header>
      <section className="rcm-profile-kpis" aria-label="Tổng hợp khách hàng">
        <div><Stat label="Chi tiêu đã ghi nhận" value={formatVnd(stats.spent)} hint="Sân, hàng hóa và thuê" /></div>
        <div><Stat label="Đã chơi" value={`${stats.played} lượt`} hint={stats.noShow ? `${stats.noShow} lần không đến` : 'Chưa bỏ lịch'} /></div>
        <div><Stat label="Hóa đơn hoàn tất" value={sales.filter((x) => x.status === 'completed').length} /></div>
        <div><Stat label="Lượt thuê đồ" value={rentals.length} /></div>
      </section>
      <nav className="rcm-section-nav" aria-label="Nội dung hồ sơ">
        <Link href={`/admin/customers/${id}`} aria-current={view === 'activity' ? 'page' : undefined}>Lịch sử giao dịch</Link>
        <Link href={`/admin/customers/${id}?view=profile`} aria-current={view === 'profile' ? 'page' : undefined}>Thông tin & quản lý</Link>
      </nav>
      <div className="rcm-profile-body">
        {view === 'activity' && (
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={`Lịch sử đặt sân (${bookings.length})`}>
            {bookings.length === 0 ? (
              <p className="text-muted">Chưa có đơn đặt sân bạn được xem.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bookings.slice(0, 8).map((b) => <BookingRow key={b.id} b={b} />)}
                {bookings.length > 8 && (
                  <li>
                    <details className="rcm-history-more">
                      <summary>Xem thêm {bookings.length - 8} đơn cũ</summary>
                      <ul className="divide-y divide-line">
                        {bookings.slice(8).map((b) => <BookingRow key={b.id} b={b} />)}
                      </ul>
                    </details>
                  </li>
                )}
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

        )}
        {view === 'profile' && (
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
          {holdStatus && <HoldPolicyCard customerId={c.id} status={holdStatus} />}
          {owner && (
            <Panel title="Quyền riêng tư" description="Bằng chứng xác nhận / đồng ý và yêu cầu về dữ liệu của khách.">
              <div className="flex flex-col gap-4">
                {consents && consents.length > 0 ? (
                  <ul className="flex flex-col gap-2 text-sm">
                    {consents.map((x) => (
                      <li key={x.id} className="flex items-start justify-between gap-3">
                        <span>
                          {x.purpose === 'marketing' ? 'Nhận tin khuyến mãi' : 'Xác nhận điều khoản'}
                          {x.bookings?.code ? <span className="text-muted"> · {x.bookings.code}</span> : null}
                          <span className="block text-xs text-muted">
                            {formatDateTime(x.created_at)}
                            {x.privacy?.version ? ` · chính sách v${x.privacy.version}` : ''}
                          </span>
                        </span>
                        <Badge tone={x.granted ? 'green' : 'neutral'}>{x.granted ? 'Đồng ý' : 'Rút lại'}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Chưa có bằng chứng xác nhận (đơn tạo trước khi bật tính năng hoặc đặt tại quầy).</p>
                )}
                {!c.anonymized_at && (
                  <>
                    <ExportCustomerData customerId={c.id} requestId={null} />
                    <AnonymizePanel customerId={c.id} requestId={null} />
                  </>
                )}
              </div>
            </Panel>
          )}
          <Panel title="Thông tin">
            {owner && !c.anonymized_at ? (
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
        )}
      </div>
    </div>
  );
}
