import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarCheck,
  ChevronRight,
  Clock,
  Landmark,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { LinkButton } from '@/components/ui/button';
import { Countdown } from '@/components/ui/interactive';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { CashFlowChart, SOURCE_STYLE } from '@/features/dashboard/components/cash-flow-chart';
import { percentChange, shares } from '@/features/dashboard/lib/metrics';
import { DASHBOARD_PERIODS, getDashboard, getNextShift, type Dashboard } from '@/features/dashboard/queries';
import { StaffHome } from '@/features/me/components/staff-home';
import { getMyMonthSummary } from '@/features/me/queries';
import { getActiveBranch } from '@/lib/auth/context';
import { requireStaff } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatTime, formatVariantLabel, formatVnd } from '@/lib/format';
import { ATTENDANCE_STATUS, BOOKING_STATUS, PAYMENT_METHOD } from '@/lib/labels';
import { type Enums } from '@/lib/supabase/database.types';
import { monthKey, todayKey } from '@/lib/time';

export const metadata = { title: 'Tổng quan' };

type Search = { branch?: string; days?: string; month?: string };

function isBookingStatus(s: string): s is Enums<'booking_status'> {
  return s in BOOKING_STATUS;
}
function isPaymentMethod(s: string): s is Enums<'payment_method'> {
  return s in PAYMENT_METHOD;
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'brand' | 'alert';
  href?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          'grid size-9 place-items-center rounded-full',
          tone === 'brand' ? 'bg-court text-on-court' : tone === 'alert' ? 'bg-shuttle text-paper' : 'bg-hall text-on-court',
        )}
      >
        {icon}
      </span>
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-[1.65rem] leading-tight break-words tabular sm:text-3xl">{value}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </>
  );
  const className = cn(
    'flex min-w-0 flex-col gap-1.5 rounded-panel border bg-paper p-4 sm:p-5',
    tone === 'brand' ? 'border-court' : tone === 'alert' ? 'border-shuttle/50' : 'border-line',
    href && 'transition-shadow hover:shadow-lift',
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Trend({ change }: { change: number | null }) {
  if (change === null) return <span>Chưa có kỳ trước để so</span>;
  const up = change >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1', up ? 'text-court-deep' : 'text-shuttle-deep')}>
      {up ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
      {up ? '+' : ''}
      {change}% so với kỳ trước
    </span>
  );
}

function Tile({ href, icon, title, lines }: { href: string; icon: ReactNode; title: string; lines: ReactNode[] }) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-panel border border-line bg-paper p-4 transition-shadow hover:shadow-lift"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-hall">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {lines.map((l, i) => (
          <span key={i} className="text-sm text-muted">
            {l}
          </span>
        ))}
      </span>
      <ChevronRight className="mt-2 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function scopeHref(branch: string | null, days: number) {
  const p = new URLSearchParams();
  if (branch) p.set('branch', branch);
  if (days !== 30) p.set('days', String(days));
  const q = p.toString();
  return q ? `/admin?${q}` : '/admin';
}

function attentionCount(d: Dashboard): number {
  return (
    (d.bookings?.awaiting_deposit.length ?? 0) +
    (d.bank?.pending ?? 0) +
    (d.rentals?.overdue ?? 0) +
    (d.stock?.out ?? 0) +
    (d.staff?.late ?? 0)
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [ctx, params] = await Promise.all([requireStaff(), searchParams]);
  const owner = isOwner(ctx);
  // Nhân viên có trang tổng quan riêng: ca của mình, lương tạm tính, giờ công, đi trễ, tăng ca, thưởng / phạt.
  if (!owner) {
    const currentMonth = monthKey(todayKey());
    const month = params.month && /^\d{4}-\d{2}-01$/.test(params.month) ? params.month : currentMonth;
    const [summary, next] = await Promise.all([
      ctx.employeeId ? getMyMonthSummary(month) : Promise.resolve(null),
      getNextShift(ctx.employeeId),
    ]);
    return <StaffHome ctx={ctx} month={month} currentMonth={currentMonth} summary={summary} nextShift={next} />;
  }
  const days = DASHBOARD_PERIODS.find((p) => String(p) === params.days) ?? 30;
  const active = await getActiveBranch(ctx);
  // Chủ sân xem gộp mọi chi nhánh (mặc định) hoặc từng chi nhánh; nhân viên xem chi nhánh đang làm việc.
  const requested = params.branch && ctx.branches.some((b) => b.branchId === params.branch) ? params.branch : null;
  const branchId = owner ? requested : (active?.branchId ?? null);
  const scopeName = branchId ? (ctx.branches.find((b) => b.branchId === branchId)?.name ?? '') : 'Tất cả chi nhánh';

  const [d, nextShift] = await Promise.all([
    owner || branchId ? getDashboard(branchId, days) : Promise.resolve(null),
    getNextShift(ctx.employeeId),
  ]);

  const greeting = (
    <PageHeader
      title={`Xin chào, ${ctx.displayName}`}
      description={d ? `${scopeName} · hôm nay ${formatDate(new Date())}` : 'Bạn chưa được gán chi nhánh nào.'}
      actions={
        d ? (
          <nav aria-label="Khoảng thời gian" className="flex gap-1 rounded-control bg-hall p-1">
            {DASHBOARD_PERIODS.map((p) => (
              <Link
                key={p}
                href={scopeHref(owner ? branchId : null, p)}
                aria-current={p === days ? 'page' : undefined}
                className={cn(
                  'rounded-[0.4rem] px-3 py-1.5 text-sm font-medium',
                  p === days ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                {p} ngày
              </Link>
            ))}
          </nav>
        ) : undefined
      }
    />
  );

  if (!d) {
    return (
      <>
        {greeting}
        {owner ? (
          <EmptyState
            title="Bắt đầu bằng chi nhánh đầu tiên"
            action={
              <LinkButton href="/admin/branches/new" variant="primary">
                Thêm chi nhánh
              </LinkButton>
            }
          >
            Tạo chi nhánh, thêm sân và bảng giá rồi công bố để khách đặt sân.
          </EmptyState>
        ) : (
          <EmptyState title="Chưa có quyền ở chi nhánh nào">Liên hệ chủ sân để được cấp quyền theo chi nhánh.</EmptyState>
        )}
      </>
    );
  }

  const cash = d.cash;
  const b = d.bookings;
  const change = cash ? percentChange(cash.period_net, cash.prev_net) : null;
  const sources = cash ? shares(cash.by_source) : [];
  const methods = cash ? shares(cash.by_method) : [];
  const attention = attentionCount(d);

  return (
    <>
      {greeting}

      {owner && ctx.branches.length > 1 && (
        <nav aria-label="Chi nhánh" className="scrollbar-none -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ branchId: null, name: 'Tất cả chi nhánh' }, ...ctx.branches.map((x) => ({ branchId: x.branchId, name: x.name }))].map((x) => (
            <Link
              key={x.branchId ?? 'all'}
              href={scopeHref(x.branchId, days)}
              aria-current={x.branchId === branchId ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap',
                x.branchId === branchId
                  ? 'border-primary bg-primary text-paper'
                  : 'border-line bg-paper hover:border-primary/50 hover:text-primary',
              )}
            >
              {x.name}
            </Link>
          ))}
        </nav>
      )}

      {/* CHỈ SỐ CHÍNH ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cash ? (
          <>
            <Kpi
              tone="brand"
              icon={<Wallet className="size-5" aria-hidden />}
              label="Thực thu hôm nay"
              value={formatVnd(cash.today_net)}
              hint={
                cash.today_refund > 0
                  ? `Vào ${formatVnd(cash.today_in)} · hoàn ${formatVnd(cash.today_refund)}`
                  : `${d.bank?.today_count ?? 0} lần nhận chuyển khoản`
              }
            />
            <Kpi
              icon={<ArrowDownLeft className="size-5" aria-hidden />}
              label={`Thực thu ${days} ngày`}
              value={formatVnd(cash.period_net)}
              hint={<Trend change={change} />}
            />
          </>
        ) : (
          b && (
            <>
              <Kpi
                tone="brand"
                icon={<CalendarCheck className="size-5" aria-hidden />}
                label="Đơn hôm nay"
                value={b.total}
                hint={`${b.confirmed} đã xác nhận`}
              />
              <Kpi
                icon={<Clock className="size-5" aria-hidden />}
                label="Lấp sân hôm nay"
                value={`${b.occupancy}%`}
                hint="Giờ đã đặt / giờ mở cửa"
              />
            </>
          )
        )}
        {b && (
          <Kpi
            tone={b.awaiting_deposit.length > 0 ? 'alert' : 'default'}
            icon={<Zap className="size-5" aria-hidden />}
            label="Đang chờ cọc"
            value={b.awaiting_deposit.length}
            hint="Tự xác nhận khi tiền về"
            href="/admin/bookings"
          />
        )}
        {cash ? (
          <Kpi
            icon={<ReceiptText className="size-5" aria-hidden />}
            label="Còn phải thu (7 ngày tới)"
            value={formatVnd(cash.receivable)}
            hint="Đơn đã xác nhận chưa trả đủ"
            href="/admin/bookings"
          />
        ) : (
          b && (
            <Kpi
              icon={<UserRoundCheck className="size-5" aria-hidden />}
              label="Khách đã đến"
              value={b.checked_in + b.completed}
              hint="Hôm nay"
            />
          )
        )}
      </div>

      {/* DÒNG TIỀN ------------------------------------------------------------- */}
      {cash && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel
            title="Dòng tiền"
            description={`Tiền vào theo ngày, ${days} ngày gần nhất (đã ghi nhận, chưa trừ hoàn).`}
            className="xl:col-span-2"
          >
            <CashFlowChart series={cash.series} />
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span>
                Tổng vào: <strong className="text-ink tabular">{formatVnd(cash.period_net + cash.period_refund)}</strong>
              </span>
              <span>
                Hoàn tiền: <strong className="text-shuttle-deep tabular">−{formatVnd(cash.period_refund)}</strong>
              </span>
              <span>
                Thực thu: <strong className="text-ink tabular">{formatVnd(cash.period_net)}</strong>
              </span>
            </p>
          </Panel>

          <Panel title="Tiền đến từ đâu" description={`${days} ngày gần nhất`}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-hall">
                  {sources.map((s) => (
                    <span key={s.key} className={SOURCE_STYLE[s.key].className} style={{ width: `${s.percent}%` }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {sources.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={`size-2.5 rounded-sm ${SOURCE_STYLE[s.key].className}`} />
                        {SOURCE_STYLE[s.key].label}
                      </span>
                      <span className="tabular">
                        {formatVnd(s.amount)} <span className="text-muted">· {s.percent}%</span>
                      </span>
                    </li>
                  ))}
                  {sources.length === 0 && <li className="text-muted">Chưa có tiền vào trong kỳ.</li>}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-medium">Theo hình thức</p>
                {methods.map((m) => (
                  <div key={m.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-1.5">
                        {m.key === 'gateway' && <Zap className="size-3.5 text-court-deep" aria-hidden />}
                        {isPaymentMethod(m.key) ? PAYMENT_METHOD[m.key] : m.key}
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular">{formatVnd(m.amount)}</span>
                    </div>
                    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-hall">
                      <span
                        className={cn('block h-full rounded-full', m.key === 'gateway' ? 'bg-court' : 'bg-ink/70')}
                        style={{ width: `${m.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
                {methods.length === 0 && <p className="text-sm text-muted">Chưa có giao dịch.</p>}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* HÔM NAY + CẦN XỬ LÝ ----------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title={attention > 0 ? `Cần xử lý (${attention})` : 'Cần xử lý'}
          description={attention > 0 ? 'Việc nên làm ngay trong ngày.' : undefined}
        >
          {attention === 0 ? (
            <p className="flex items-center gap-2 text-court-deep">
              <UserRoundCheck className="size-5" aria-hidden />
              Mọi thứ đều ổn — không có việc tồn đọng.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {b?.awaiting_deposit.map((h) => (
                <li key={h.id}>
                  <Link href={`/admin/bookings/${h.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <Zap className="size-4 shrink-0 text-amber-deep" aria-hidden />
                        Chờ cọc · {h.contact_name}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {h.code} · {h.court_name}, {formatTime(h.starts_at)} {formatDate(h.starts_at)}
                        {h.paid_amount > 0
                          ? ` · đã nhận ${formatVnd(h.paid_amount)}/${formatVnd(h.deposit_amount)}`
                          : ` · cọc ${formatVnd(h.deposit_amount)}`}
                      </span>
                    </span>
                    <Countdown until={h.hold_expires_at} className="shrink-0 font-display text-lg text-shuttle-deep tabular" />
                  </Link>
                </li>
              ))}
              {(d.bank?.pending ?? 0) > 0 && (
                <li>
                  <Link href="/admin/bank" className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <Landmark className="size-4 shrink-0 text-shuttle-deep" aria-hidden />
                        {d.bank?.pending} giao dịch ngân hàng chưa khớp đơn
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {d.bank?.pending_list
                          .slice(0, 2)
                          .map((t) => `${formatVnd(t.amount)} “${t.content ?? ''}”`)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )}
              {(d.rentals?.overdue ?? 0) > 0 && (
                <li>
                  <Link href="/admin/rentals" className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <Package className="size-4 shrink-0 text-shuttle-deep" aria-hidden />
                        {d.rentals?.overdue} lượt thuê quá hạn trả
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {d.rentals?.overdue_list
                          .slice(0, 3)
                          .map((r) => `${r.customer ?? r.code} (hạn ${formatTime(r.due_at)})`)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )}
              {(d.stock?.out ?? 0) > 0 && (
                <li>
                  <Link href="/admin/inventory" className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span className="flex items-center gap-2 font-medium">
                      <Boxes className="size-4 shrink-0 text-shuttle-deep" aria-hidden />
                      {d.stock?.out} mặt hàng đã hết
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )}
              {(d.staff?.late ?? 0) > 0 && (
                <li>
                  <Link href="/admin/shifts" className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="size-4 shrink-0 text-amber-deep" aria-hidden />
                      {d.staff?.late} ca đã tới giờ nhưng chưa chấm công vào
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Panel>

        {b && (
          <Panel
            title="Sân hôm nay"
            actions={
              <Link href="/admin/bookings" className="text-sm underline underline-offset-4">
                Mở lịch
              </Link>
            }
          >
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm text-muted">Lấp sân</span>
                <span className="font-display text-2xl tabular">{b.occupancy}%</span>
              </div>
              <div aria-hidden className="h-2 overflow-hidden rounded-full bg-hall">
                <span className="block h-full rounded-full bg-court" style={{ width: `${Math.min(100, b.occupancy)}%` }} />
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>{b.total} đơn</span>
                <span>{b.confirmed} chờ đến</span>
                <span>{b.checked_in} đang chơi</span>
                <span>{b.completed} xong</span>
                {b.cancelled > 0 && <span className="text-shuttle-deep">{b.cancelled} hủy / không đến</span>}
                {b.new_online > 0 && <span>{b.new_online} đặt online hôm nay</span>}
              </p>
            </div>
            {b.upcoming.length === 0 ? (
              <p className="text-muted">Không còn đơn nào trong hôm nay.</p>
            ) : (
              <ul className="divide-y divide-line">
                {b.upcoming.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/bookings/${u.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-hall/60">
                      <span className="min-w-0">
                        <span className="font-display text-lg tabular">{formatTime(u.starts_at)}</span>
                        <span className="ml-3">{u.contact_name}</span>
                        <span className="text-sm text-muted">
                          , {u.court_name}
                          {d.scope === 'all' ? ` · ${u.branch_name}` : ''}
                        </span>
                      </span>
                      {isBookingStatus(u.status) && (
                        <Badge tone={BOOKING_STATUS[u.status].tone} className="shrink-0">
                          {BOOKING_STATUS[u.status].label}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {/* GIAO DỊCH GẦN ĐÂY + CÁC MẢNG KHÁC ---------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {cash && (
          <Panel title="Giao dịch gần đây">
            {cash.recent.length === 0 ? (
              <p className="text-muted">Chưa có giao dịch.</p>
            ) : (
              <ul className="divide-y divide-line">
                {cash.recent.map((p) => {
                  const href = p.booking_id
                    ? `/admin/bookings/${p.booking_id}`
                    : p.sale_id
                      ? `/admin/sales/${p.sale_id}`
                      : `/admin/rentals/${p.rental_id ?? ''}`;
                  const refund = p.kind === 'refund';
                  return (
                    <li key={p.id}>
                      <Link href={href} className="flex items-center gap-3 py-2.5 hover:bg-hall/60">
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-full',
                            refund ? 'bg-shuttle-soft text-shuttle-deep' : 'bg-court-soft text-court-deep',
                          )}
                        >
                          {refund ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownLeft className="size-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {SOURCE_STYLE[p.source].label} · {p.ref_code}
                          </span>
                          <span className="flex items-center gap-1 truncate text-xs text-muted">
                            {p.method === 'gateway' && <Zap className="size-3 text-court-deep" aria-hidden />}
                            {isPaymentMethod(p.method) ? PAYMENT_METHOD[p.method] : p.method} · {formatDateTime(p.received_at)}
                          </span>
                        </span>
                        <span className={cn('shrink-0 font-medium tabular', refund ? 'text-shuttle-deep' : 'text-court-deep')}>
                          {refund ? '−' : '+'}
                          {formatVnd(p.amount)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-xl">Các mảng khác</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.bank && (
              <Tile
                href="/admin/bank"
                icon={<Landmark className="size-5" aria-hidden />}
                title="Chuyển khoản SePay"
                lines={[
                  `Hôm nay ${d.bank.today_count} GD · ${formatVnd(d.bank.today_amount)}`,
                  `${d.bank.auto_matched_period} đơn tự xác nhận / ${days} ngày`,
                ]}
              />
            )}
            {d.sales && (
              <Tile
                href="/admin/sales"
                icon={<ReceiptText className="size-5" aria-hidden />}
                title="Bán hàng"
                lines={[
                  `Hôm nay ${d.sales.today_count} đơn · ${formatVnd(d.sales.today_total)}`,
                  d.sales.top[0] ? `Bán chạy: ${d.sales.top[0].name}` : `${d.sales.period_count} đơn / ${days} ngày`,
                ]}
              />
            )}
            {d.rentals && (
              <Tile
                href="/admin/rentals"
                icon={<Package className="size-5" aria-hidden />}
                title="Cho thuê"
                lines={[`Đang thuê ${d.rentals.out}`, d.rentals.overdue > 0 ? `${d.rentals.overdue} quá hạn` : 'Không có lượt quá hạn']}
              />
            )}
            {d.stock && (
              <Tile
                href="/admin/inventory"
                icon={<Boxes className="size-5" aria-hidden />}
                title="Tồn kho"
                lines={[
                  `${d.stock.low} mặt hàng sắp hết${d.stock.out ? ` · ${d.stock.out} đã hết` : ''}`,
                  d.stock.list[0]
                    ? `${d.stock.list[0].name}${formatVariantLabel(d.stock.list[0].size, d.stock.list[0].color) ? ` (${formatVariantLabel(d.stock.list[0].size, d.stock.list[0].color)})` : ''}: còn ${d.stock.list[0].on_hand}`
                    : 'Đủ hàng',
                ]}
              />
            )}
            {d.members && (
              <Tile
                href="/admin/customers?tab=members"
                icon={<Users className="size-5" aria-hidden />}
                title="Thành viên"
                lines={[`${d.members.total} tài khoản`, `+${d.members.new_period} trong ${days} ngày`]}
              />
            )}
            {d.staff && (
              <Tile
                href="/admin/shifts"
                icon={<Clock className="size-5" aria-hidden />}
                title="Nhân sự hôm nay"
                lines={[
                  `${d.staff.on_shift} đang trong ca / ${d.staff.scheduled_today} ca`,
                  d.staff.late ? `${d.staff.late} ca chưa chấm công` : 'Đúng giờ',
                ]}
              />
            )}
          </div>
          {nextShift && (
            <div className="flex items-center justify-between gap-3 rounded-panel border border-line bg-paper p-4">
              <span className="min-w-0">
                <span className="text-sm text-muted">Ca tiếp theo của bạn</span>
                <span className="block font-display text-xl tabular">
                  {formatTime(nextShift.scheduled_start)}–{formatTime(nextShift.scheduled_end)}
                </span>
                <span className="text-sm text-muted">
                  {formatDate(nextShift.scheduled_start)}, {nextShift.branches?.name}
                </span>
              </span>
              <Badge tone={ATTENDANCE_STATUS[nextShift.status].tone}>
                {nextShift.checked_in_at ? 'Đang trong ca' : ATTENDANCE_STATUS[nextShift.status].label}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
