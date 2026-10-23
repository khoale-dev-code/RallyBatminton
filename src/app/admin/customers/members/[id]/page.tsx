import { initialsOf } from '@/features/member/lib/initials';
import '@/features/admin-customers/rally-customers-v15.css';
import { ArrowLeft, Lock, Minus, Plus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, DescriptionList, Panel, Stat } from '@/components/ui/primitives';
import {
  AdjustPointsForm,
  MemberInfoForm,
  MemberLockButton,
  TempPasswordButton,
} from '@/features/admin-customers/components/member-admin-forms';
import { MemberTierBadge } from '@/features/admin-customers/components/member-tier-badge';
import { getMember } from '@/features/admin-customers/queries';
import { tierProgress } from '@/features/member/lib/tiers';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatNumber, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_STATUS } from '@/lib/labels';

export const metadata = { title: 'Thành viên' };

const LOGIN_KIND = { phone: 'Số điện thoại', email: 'Email', google: 'Google' } as const;

type CustomerBookingItem = NonNullable<Awaited<ReturnType<typeof getMember>>>['bookings'][number];

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

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { view: requestedView } = await searchParams;
  const view = requestedView === 'account' ? 'account' : 'activity';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ ctx }, data] = await withGuard(requireBranchPermission('booking.view'), () => getMember(id));
  if (!data) notFound();
  const { member: m, bookings, ledger } = data;
  const owner = isOwner(ctx);
  const progress = tierProgress(m.lifetime_points);

  return (
    <div className="rcm-page">
      <header className="rcm-profile-header">
        <span className="rcm-profile-avatar" aria-hidden>{initialsOf(m.full_name)}</span>
        <div className="min-w-0 flex-1">
          <Link href="/admin/customers?tab=members" className="rcm-profile-back"><ArrowLeft size={14} aria-hidden /> Danh sách thành viên</Link>
          <h1>{m.full_name}</h1>
          <p>{m.phone ? formatPhone(m.phone) : (m.email ?? 'Chưa có thông tin liên hệ')}</p>
          <div className="rcm-profile-badges">
            <MemberTierBadge tier={m.tier} />
            {m.is_locked && <Badge tone="red"><Lock size={12} aria-hidden /> Đang khóa</Badge>}
            {m.must_change_password && <Badge tone="amber">Đang dùng mật khẩu tạm</Badge>}
          </div>
        </div>
        <UserRound size={28} aria-hidden className="opacity-40" />
      </header>
      <section className="rcm-profile-kpis" aria-label="Thống kê thành viên">
        <div><Stat label="Điểm khả dụng" value={formatNumber(m.points)} hint={progress.next ? `Còn ${formatNumber(progress.remaining)} điểm lên ${progress.next.label}` : 'Hạng cao nhất'} /></div>
        <div><Stat label="Tổng điểm tích" value={formatNumber(m.lifetime_points)} /></div>
        <div><Stat label="Đơn đặt sân" value={formatNumber(m.stats.bookings)} hint={`${m.stats.completed} hoàn tất${m.stats.no_show ? ` · ${m.stats.no_show} không đến` : ''}`} /></div>
        <div><Stat label="Chi tiêu tiền sân" value={formatVnd(m.stats.spent)} /></div>
      </section>
      <nav className="rcm-section-nav" aria-label="Nội dung thành viên">
        <Link href={`/admin/customers/members/${id}`} aria-current={view === 'activity' ? 'page' : undefined}>Lịch sử & điểm thưởng</Link>
        <Link href={`/admin/customers/members/${id}?view=account`} aria-current={view === 'account' ? 'page' : undefined}>Tài khoản & bảo mật</Link>
      </nav>
      <div className="rcm-profile-body">
        {view === 'activity' && (
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={`Đơn của thành viên (${bookings.length})`} description="Chỉ hiện đơn ở chi nhánh bạn được xem.">
            {bookings.length === 0 ? (
              <p className="text-muted">Chưa có đơn nào gắn với tài khoản.</p>
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

          <Panel title="Lịch sử điểm" description="Sổ điểm chỉ thêm dòng, không sửa — mọi điều chỉnh đều có lý do và người thực hiện.">
            {ledger.length === 0 ? (
              <p className="text-muted">Chưa có biến động điểm.</p>
            ) : (
              <ul className="divide-y divide-line">
                {ledger.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full',
                        l.delta > 0 ? 'bg-court-soft text-court-deep' : 'bg-shuttle-soft text-shuttle-deep',
                      )}
                    >
                      {l.delta > 0 ? <Plus className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{l.reason}</span>
                      <span className="text-xs text-muted">
                        {l.kind === 'booking' ? 'Tự động' : 'Điều chỉnh tay'} · {formatDateTime(l.created_at)}
                      </span>
                    </span>
                    <span className={cn('font-semibold tabular', l.delta > 0 ? 'text-court-deep' : 'text-shuttle-deep')}>
                      {l.delta > 0 ? '+' : ''}
                      {formatNumber(l.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>


        )}
        {view === 'account' && (
        <div className="flex flex-col gap-6">
          <Panel title="Tài khoản">
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                { label: 'Đăng ký bằng', value: LOGIN_KIND[m.login_kind] },
                { label: 'Email', value: m.email ?? '—' },
                { label: 'Ngày tham gia', value: formatDate(m.created_at) },
                { label: 'Đăng nhập gần nhất', value: m.last_sign_in_at ? formatDateTime(m.last_sign_in_at) : 'Chưa đăng nhập' },
                {
                  label: 'Hồ sơ khách tại quầy',
                  value: m.customer ? (
                    <Link href={`/admin/customers/${m.customer.id}`} className="font-medium text-court-deep hover:underline">
                      {m.customer.full_name} · {formatPhone(m.customer.phone)}
                    </Link>
                  ) : (
                    'Chưa liên kết (khi khách đặt bằng đúng SĐT trong tài khoản sẽ tự liên kết)'
                  ),
                },
                { label: 'Nhận tin ưu đãi', value: m.marketing_opt_in ? 'Có' : 'Không' },
              ]}
            />
          </Panel>
          {owner ? (
            <>
              <Panel title="Thông tin">
                <MemberInfoForm member={m} />
              </Panel>
              <Panel title="Điều chỉnh điểm">
                <AdjustPointsForm userId={m.user_id} />
              </Panel>
              <Panel title="Bảo mật">
                <div className="flex flex-col gap-3">
                  <TempPasswordButton userId={m.user_id} />
                  <MemberLockButton userId={m.user_id} locked={m.is_locked} />
                </div>
              </Panel>
            </>
          ) : (
            m.staff_note && (
              <Panel title="Ghi chú nội bộ">
                <p className="text-sm whitespace-pre-line">{m.staff_note}</p>
              </Panel>
            )
          )}
        </div>
        )}
      </div>
    </div>
  );
}
