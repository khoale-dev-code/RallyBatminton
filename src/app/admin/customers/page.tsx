import Form from 'next/form';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, LockKeyhole, Mail, Search, Smartphone, Users, UserRoundCheck } from 'lucide-react';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { MemberTierBadge } from '@/features/admin-customers/components/member-tier-badge';
import { listMembers, MEMBER_FILTERS, MEMBER_PAGE_SIZE, searchCustomers, type MemberFilter } from '@/features/admin-customers/queries';
import { initialsOf } from '@/features/member/lib/initials';
import { requireBranchPermission, withGuard } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import '@/features/admin-customers/rally-customers-v15.css';

export const metadata = { title: 'Khách hàng' };

type SearchParams = { q?: string; tab?: string; filter?: string; page?: string };
const FILTER_LABEL: Record<MemberFilter, string> = {
  all: 'Tất cả hạng',
  silver: 'Hạng Bạc',
  gold: 'Hạng Vàng',
  diamond: 'Kim cương',
  no_phone: 'Chưa có SĐT',
  locked: 'Đang khóa',
};
const LOGIN_ICONS = { phone: Smartphone, email: Mail, google: Mail } as const;

function hrefWith(base: SearchParams, patch: Partial<SearchParams>) {
  const params = new URLSearchParams();
  Object.entries({ ...base, ...patch }).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return `/admin/customers${query ? `?${query}` : ''}`;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 60) : undefined;
  const tab = params.tab === 'members' ? 'members' : 'customers';
  const filter = MEMBER_FILTERS.find((item) => item === params.filter) ?? 'all';
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requestedPage) ? Math.min(100000, Math.max(1, requestedPage)) : 1;
  const [, [customers, members]] = await withGuard(requireBranchPermission('booking.view'), () =>
    Promise.all([
      tab === 'customers' ? searchCustomers(q) : Promise.resolve([]),
      listMembers(tab === 'members' ? q : undefined, tab === 'members' ? filter : 'all', tab === 'members' ? page : 1),
    ]),
  );
  const pages = members ? Math.max(1, Math.ceil(members.total / MEMBER_PAGE_SIZE)) : 1;
  const linkedVisible = customers.filter((c) => c.member).length;

  return (
    <div className="rcm-page">
      <header className="rcm-heading">
        <div>
          <p className="rcm-eyebrow"><Users size={14} aria-hidden /> RALLY CRM / QUẢN LÝ KHÁCH HÀNG</p>
          <h1>Khách hàng</h1>
          <p>Tra cứu khách đến sân, xem lịch sử giao dịch và quản lý tài khoản thành viên tại một nơi.</p>
        </div>
        <div className="rcm-heading-note"><UserRoundCheck size={17} aria-hidden /> Khách vãng lai không cần tạo tài khoản</div>
      </header>

      <section className="rcm-metrics" aria-label="Thông tin khách hàng">
        {tab === 'members' && members ? (
          <>
            <div className="rcm-metric"><span>Tổng thành viên</span><strong>{formatNumber(members.summary.members)}</strong><small>Tài khoản đã đăng ký</small></div>
            <div className="rcm-metric"><span>Thành viên mới</span><strong>{formatNumber(members.summary.new_30d)}</strong><small>Trong 30 ngày</small></div>
            <div className="rcm-metric"><span>Có số điện thoại</span><strong>{formatNumber(members.summary.with_phone)}</strong><small>Có thể liên kết hồ sơ quầy</small></div>
            <div className="rcm-metric"><span>Đang khóa</span><strong>{formatNumber(members.summary.locked)}</strong><small>Cần kiểm tra trạng thái</small></div>
          </>
        ) : (
          <>
            <div className="rcm-metric"><span>Khách đang hiển thị</span><strong>{formatNumber(customers.length)}</strong><small>Tối đa 50 kết quả gần nhất</small></div>
            <div className="rcm-metric"><span>Có liên kết thành viên</span><strong>{formatNumber(linkedVisible)}</strong><small>Trong kết quả đang xem</small></div>
            <div className="rcm-metric"><span>Thành viên hệ thống</span><strong>{members ? formatNumber(members.summary.members) : '—'}</strong><small>{members ? 'Tổng số tài khoản' : 'Chưa lấy được dữ liệu'}</small></div>
          </>
        )}
      </section>

      <section className="rcm-results" aria-label="Danh sách khách hàng">
        <div className="rcm-toolbar">
          <nav className="rcm-tabs" aria-label="Loại khách hàng">
            <Link href="/admin/customers" aria-current={tab === 'customers' ? 'page' : undefined} className={cn('rcm-tab', tab === 'customers' && 'is-active')}>Tất cả khách</Link>
            <Link href="/admin/customers?tab=members" aria-current={tab === 'members' ? 'page' : undefined} className={cn('rcm-tab', tab === 'members' && 'is-active')}>Thành viên {members && <span>{formatNumber(members.summary.members)}</span>}</Link>
          </nav>
          <Form action="/admin/customers" data-nav-progress className="rcm-search-form">
            {tab === 'members' && <input type="hidden" name="tab" value="members" />}
            {tab === 'members' && filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
            <label htmlFor="rcm-search" className="sr-only">Tìm khách hàng</label>
            <div className="rcm-search-input">
              <Search size={18} aria-hidden />
              <input id="rcm-search" name="q" defaultValue={q} placeholder={tab === 'members' ? 'Tìm tên, SĐT hoặc email…' : 'Tìm theo tên hoặc số điện thoại…'} />
            </div>
            <button className="rcm-search-submit" type="submit">Tìm kiếm <ArrowRight size={16} aria-hidden /></button>
          </Form>
        </div>

        {tab === 'members' && (
          <nav className="rcm-filter-pills" aria-label="Lọc thành viên">
            {MEMBER_FILTERS.map((item) => (
              <Link key={item} className={cn('rcm-pill', filter === item && 'is-active')}
                href={hrefWith({ tab: 'members', q }, { filter: item === 'all' ? undefined : item, page: undefined })}
                aria-current={filter === item ? 'page' : undefined}>
                {FILTER_LABEL[item]}
              </Link>
            ))}
          </nav>
        )}

        <div className="rcm-list-topline">
          <div><h2>{tab === 'members' ? 'Danh sách thành viên' : 'Danh sách khách đến sân'}</h2>
            <p>{tab === 'members' ? (members ? `${formatNumber(members.total)} kết quả phù hợp` : 'Không thể tải thành viên') : '50 khách gần nhất hoặc kết quả theo từ khóa. Chọn khách để xem chi tiết.'}</p></div>
          <span className="rcm-list-hint"><CalendarDays size={15} aria-hidden /> Cập nhật từ dữ liệu Rally</span>
        </div>

        {tab === 'customers' ? (
          customers.length === 0 ? <div className="rcm-empty"><EmptyState title="Không tìm thấy khách">Thử nhập tên hoặc số điện thoại khác.</EmptyState></div> : (
            <>
              <div className="rcm-table-head" aria-hidden><span>Khách hàng</span><span>Liên hệ</span><span>Ngày ghi nhận</span><span>Chi tiết</span></div>
              <ul className="rcm-list">
                {customers.map((customer) => (
                  <li key={customer.id}>
                    <Link className="rcm-person-row" href={`/admin/customers/${customer.id}`}>
                      <span className="rcm-person-identity">
                        <span className="rcm-avatar" aria-hidden>{initialsOf(customer.full_name)}</span>
                        <span className="rcm-person-name"><strong>{customer.full_name}</strong><span>{customer.member ? <MemberTierBadge tier={customer.member.tier} /> : <Badge>Vãng lai</Badge>}</span></span>
                      </span>
                      <span className="rcm-detail-cell"><Smartphone size={15} aria-hidden />{formatPhone(customer.phone)}</span>
                      <span className="rcm-detail-cell rcm-date"><CalendarDays size={15} aria-hidden />{formatDate(customer.created_at)}</span>
                      <span className="rcm-open" aria-label="Mở hồ sơ"><ChevronRight size={19} aria-hidden /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              {customers.length >= 50 && <p className="rcm-footnote">Danh sách chỉ tải 50 hồ sơ gần nhất. Dùng ô tìm kiếm để tra cứu khách cũ.</p>}
            </>
          )
        ) : !members ? (
          <div className="rcm-empty"><EmptyState title="Chưa đọc được danh sách thành viên">Kiểm tra RPC admin_list_members và migration 11_members.sql trong Supabase.</EmptyState></div>
        ) : members.rows.length === 0 ? (
          <div className="rcm-empty"><EmptyState title="Không có thành viên phù hợp">Hãy thử bộ lọc hoặc từ khóa khác.</EmptyState></div>
        ) : (
          <>
            <div className="rcm-table-head rcm-members-head" aria-hidden><span>Thành viên</span><span>Liên hệ</span><span>Đặt sân</span><span>Điểm</span><span>Chi tiết</span></div>
            <ul className="rcm-list">
              {members.rows.map((m) => {
                const LoginIcon = LOGIN_ICONS[m.login_kind];
                return (
                  <li key={m.user_id}>
                    <Link className="rcm-person-row rcm-member-row" href={`/admin/customers/members/${m.user_id}`}>
                      <span className="rcm-person-identity"><span className="rcm-avatar is-member" aria-hidden>{initialsOf(m.full_name)}</span>
                        <span className="rcm-person-name"><strong>{m.full_name}</strong><span className="rcm-person-tags"><MemberTierBadge tier={m.tier} />{m.is_locked && <Badge tone="red"><LockKeyhole size={12} aria-hidden /> Khóa</Badge>}</span></span>
                      </span>
                      <span className="rcm-detail-cell rcm-contact"><LoginIcon size={15} aria-hidden /><span className="rcm-contact-text">{m.phone ? formatPhone(m.phone) : (m.email ?? '—')}{m.phone && m.email && <small>{m.email}</small>}</span></span>
                      <span className="rcm-detail-cell rcm-booking-count">{formatNumber(m.booking_count)} lượt</span>
                      <span className="rcm-detail-cell rcm-points">{formatNumber(m.points)} điểm</span>
                      <span className="rcm-open" aria-label="Mở hồ sơ"><ChevronRight size={19} aria-hidden /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {pages > 1 && <nav aria-label="Phân trang thành viên" className="rcm-pagination">
              <span>Trang {page}/{pages} · {formatNumber(members.total)} thành viên</span>
              <div>
                {page > 1 && <Link href={hrefWith({ tab: 'members', q, filter: filter === 'all' ? undefined : filter }, { page: String(page - 1) })}><ArrowLeft size={16} aria-hidden /> Trước</Link>}
                {page < pages && <Link href={hrefWith({ tab: 'members', q, filter: filter === 'all' ? undefined : filter }, { page: String(page + 1) })}>Sau <ArrowRight size={16} aria-hidden /></Link>}
              </div>
            </nav>}
          </>
        )}
      </section>
    </div>
  );
}
