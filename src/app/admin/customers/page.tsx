import Form from 'next/form';
import { Lock, Mail, Search, Smartphone } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { MemberTierBadge } from '@/features/admin-customers/components/member-tier-badge';
import { listMembers, MEMBER_FILTERS, MEMBER_PAGE_SIZE, searchCustomers, type MemberFilter } from '@/features/admin-customers/queries';
import { initialsOf } from '@/features/member/lib/initials';
import { requireBranchPermission } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';

export const metadata = { title: 'Khách hàng' };

const FILTER_LABEL: Record<MemberFilter, string> = {
  all: 'Tất cả',
  silver: 'Hạng Bạc',
  gold: 'Hạng Vàng',
  diamond: 'Kim cương',
  no_phone: 'Chưa có SĐT',
  locked: 'Đang khóa',
};

const LOGIN_ICON = { phone: Smartphone, email: Mail, google: Mail } as const;

type Search = { q?: string; tab?: string; filter?: string; page?: string };

function hrefWith(params: Search, patch: Partial<Search>): string {
  const merged = { ...params, ...patch };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/admin/customers?${s}` : '/admin/customers';
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireBranchPermission('booking.view');
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 60) : undefined;
  const tab = params.tab === 'members' ? 'members' : 'customers';
  const filter = MEMBER_FILTERS.find((f) => f === params.filter) ?? 'all';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const [customers, members] = await Promise.all([
    tab === 'customers' ? searchCustomers(q) : Promise.resolve([]),
    listMembers(tab === 'members' ? q : undefined, tab === 'members' ? filter : 'all', tab === 'members' ? page : 1),
  ]);
  const pages = members ? Math.max(1, Math.ceil(members.total / MEMBER_PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Khách vãng lai được tạo tự động khi đặt sân, mua hoặc thuê. Thành viên là khách có tài khoản trên website (tích điểm, xem đơn)."
      />

      <div role="tablist" aria-label="Loại khách" className="mb-4 flex w-fit gap-1 rounded-control bg-hall p-1">
        {[
          { key: 'customers', label: 'Tất cả khách', count: null },
          { key: 'members', label: 'Thành viên', count: members?.summary.members ?? null },
        ].map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            href={t.key === 'members' ? '/admin/customers?tab=members' : '/admin/customers'}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-[0.4rem] px-4 text-sm font-medium',
              tab === t.key ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== null && (
              <span className={cn('rounded-full px-1.5 text-xs tabular', tab === t.key ? 'bg-ink text-paper' : 'bg-paper')}>
                {formatNumber(t.count)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === 'members' && members && (
        <div className="mb-4 grid grid-cols-2 gap-4 rounded-panel border border-line bg-paper p-4 sm:p-5 lg:grid-cols-4">
          <Stat label="Tổng thành viên" value={formatNumber(members.summary.members)} />
          <Stat label="Mới trong 30 ngày" value={formatNumber(members.summary.new_30d)} />
          <Stat label="Có số điện thoại" value={formatNumber(members.summary.with_phone)} hint="Gắn được với hồ sơ khách tại quầy" />
          <Stat label="Đang khóa" value={formatNumber(members.summary.locked)} />
        </div>
      )}

      <Form data-nav-progress action="/admin/customers" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {tab === 'members' && <input type="hidden" name="tab" value="members" />}
        {tab === 'members' && filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        <label htmlFor="q" className="sr-only">
          Tìm khách
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={tab === 'members' ? 'Tên, số điện thoại hoặc email' : 'Tên hoặc số điện thoại'}
            className="min-h-11 w-full rounded-control border border-line bg-paper pr-3 pl-9"
          />
        </div>
        <button type="submit" className={buttonClass('primary')}>
          Tìm
        </button>
      </Form>

      {tab === 'members' && (
        <div className="scrollbar-none mb-4 flex gap-1.5 overflow-x-auto">
          {MEMBER_FILTERS.map((f) => (
            <Link
              key={f}
              href={hrefWith({ tab: 'members', q }, { filter: f === 'all' ? undefined : f })}
              aria-current={filter === f ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap',
                filter === f ? 'border-court-strong bg-court-soft font-medium text-court-deep' : 'border-line hover:border-ink/40',
              )}
            >
              {FILTER_LABEL[f]}
            </Link>
          ))}
        </div>
      )}

      {tab === 'customers' ? (
        customers.length === 0 ? (
          <EmptyState title="Không tìm thấy khách" />
        ) : (
          <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/customers/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-hall/60 sm:px-6"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-medium">{c.full_name}</span>
                    {c.member ? <MemberTierBadge tier={c.member.tier} /> : <Badge>Vãng lai</Badge>}
                  </span>
                  <span className="text-sm text-muted tabular">
                    {formatPhone(c.phone)}, từ {formatDate(c.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : !members ? (
        <EmptyState title="Chưa xem được danh sách thành viên">
          Hãy chạy file SQL 11_members.sql trong Supabase rồi tải lại trang.
        </EmptyState>
      ) : members.rows.length === 0 ? (
        <EmptyState title="Không có thành viên phù hợp" />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-paper">
            {members.rows.map((m) => {
              const LoginIcon = LOGIN_ICON[m.login_kind];
              return (
                <li key={m.user_id}>
                  <Link
                    href={`/admin/customers/members/${m.user_id}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-hall/60 sm:px-6 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_7rem_6rem]"
                  >
                    <span className="row-span-2 grid size-10 place-items-center rounded-full bg-ink font-display text-paper md:row-span-1">
                      {initialsOf(m.full_name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{m.full_name}</span>
                        <MemberTierBadge tier={m.tier} />
                        {m.is_locked && (
                          <Badge tone="red">
                            <Lock className="mr-1 size-3" aria-hidden />
                            Khóa
                          </Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-sm text-muted">
                        <LoginIcon className="size-3.5 shrink-0" aria-hidden />
                        {m.phone ? formatPhone(m.phone) : (m.email ?? '—')}
                        {m.phone && m.email ? ` · ${m.email}` : ''}
                      </span>
                    </span>
                    <span className="col-start-2 text-sm text-muted md:col-start-auto">
                      {m.booking_count} đơn · từ {formatDate(m.created_at)}
                    </span>
                    <span className="hidden text-sm text-muted md:block">
                      {m.last_sign_in_at ? `Vào ${formatDate(m.last_sign_in_at)}` : 'Chưa đăng nhập'}
                    </span>
                    <span className="hidden text-right font-display text-xl tabular md:block">
                      {formatNumber(m.points)}
                      <span className="ml-1 font-sans text-xs text-muted">điểm</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <nav aria-label="Trang" className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                Trang {page}/{pages} · {formatNumber(members.total)} thành viên
              </span>
              <span className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={hrefWith({ tab: 'members', q, filter: filter === 'all' ? undefined : filter }, { page: String(page - 1) })}
                    className={buttonClass('outline', 'sm')}
                  >
                    Trước
                  </Link>
                )}
                {page < pages && (
                  <Link
                    href={hrefWith({ tab: 'members', q, filter: filter === 'all' ? undefined : filter }, { page: String(page + 1) })}
                    className={buttonClass('outline', 'sm')}
                  >
                    Sau
                  </Link>
                )}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
