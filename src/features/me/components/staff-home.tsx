import {
  AlarmClock,
  ArrowRight,
  BadgeMinus,
  BadgePlus,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Hourglass,
  KeyRound,
  QrCode,
  ReceiptText,
  ScanQrCode,
  ShoppingCart,
  Timer,
  UserX,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { LinkButton } from '@/components/ui/button';
import { PeriodNav } from '@/components/ui/day-nav';
import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { hasPermission, type StaffContext } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatMinutes, formatMonthKey, formatTime, formatVnd } from '@/lib/format';
import { addMonths } from '@/lib/time';

import { type MonthSummary } from '../queries';

interface NextShift {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  checked_in_at: string | null;
  branches: { name: string } | null;
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'brand';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-panel border bg-paper p-4',
        tone === 'brand' ? 'border-court bg-court-soft' : 'border-line',
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted">
        <span
          className={cn(
            'grid size-8 place-items-center rounded-full',
            tone === 'good' && 'bg-court-soft text-court-deep',
            tone === 'bad' && 'bg-shuttle-soft text-shuttle-deep',
            tone === 'brand' && 'bg-court-strong text-paper',
            tone === 'default' && 'bg-hall text-ink',
          )}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="font-display text-2xl leading-tight break-words tabular sm:text-[1.75rem]">{value}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

function Action({ href, icon, label, hint }: { href: string; icon: ReactNode; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-panel border border-line bg-paper p-4 transition-shadow hover:shadow-lift"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-ink text-paper">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Tổng quan của nhân viên: ca kế tiếp + lương tạm tính tháng, giờ công, đi trễ, tăng ca, thưởng / khấu trừ. */
export function StaffHome({
  ctx,
  month,
  currentMonth,
  summary,
  nextShift,
}: {
  ctx: StaffContext;
  month: string;
  currentMonth: string;
  summary: MonthSummary | null;
  nextShift: NextShift | null;
}) {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(ctx, p);
  const inShift = Boolean(nextShift?.checked_in_at);
  const s = summary;
  const isCurrent = month === currentMonth;

  return (
    <>
      <PageHeader
        title={`Xin chào, ${ctx.displayName}`}
        description={`Hôm nay ${formatDate(new Date())}`}
        actions={
          ctx.employeeId ? (
            <LinkButton href="/checkin" variant="court">
              <QrCode className="size-4" aria-hidden />
              Quét QR chấm công
            </LinkButton>
          ) : undefined
        }
      />

      {nextShift && (
        <section
          aria-label="Ca của tôi"
          className={cn(
            'mb-6 flex flex-col gap-3 rounded-panel border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
            inShift ? 'border-court bg-court-strong text-paper' : 'border-line bg-paper',
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', inShift ? 'bg-paper/15' : 'bg-hall')} aria-hidden>
              <CalendarClock className="size-5" />
            </span>
            <div>
              <p className={cn('text-sm', inShift ? 'text-paper/80' : 'text-muted')}>
                {inShift ? 'Bạn đang trong ca' : 'Ca tiếp theo'} · {nextShift.branches?.name}
              </p>
              <p className="font-display text-2xl tabular">
                {formatTime(nextShift.scheduled_start)}–{formatTime(nextShift.scheduled_end)}
                <span className={cn('ml-2 font-sans text-base', inShift ? 'text-paper/80' : 'text-muted')}>
                  {formatDate(nextShift.scheduled_start)}
                </span>
              </p>
            </div>
          </div>
          <p className={cn('text-sm', inShift ? 'text-paper/90' : 'text-muted')}>
            {inShift ? (
              <>Vào ca lúc {formatDateTime(nextShift.checked_in_at ?? '')} · nhớ quét QR ra ca khi về</>
            ) : (
              <>Nhớ quét QR vào ca (mở trước giờ vào ca 60 phút)</>
            )}
          </p>
        </section>
      )}

      {s && s.pending_overtime > 0 && (
        <Link
          href="/admin/me"
          className="mb-6 flex items-center gap-3 rounded-panel border-2 border-amber-deep/40 bg-amber-soft p-4 hover:shadow-lift"
        >
          <Hourglass className="size-5 shrink-0 text-amber-deep" aria-hidden />
          <span className="flex-1 font-medium">Bạn có {s.pending_overtime} đề nghị tăng ca chờ trả lời</span>
          <ArrowRight className="size-4 text-amber-deep" aria-hidden />
        </Link>
      )}

      {ctx.employeeId && (
        <>
          <PeriodNav
            prevHref={`/admin?month=${addMonths(month, -1)}`}
            nextHref={`/admin?month=${addMonths(month, 1)}`}
            prevLabel="Tháng trước"
            nextLabel="Tháng sau"
            currentHref="/admin"
            currentLabel="Tháng này"
          >
            <span className="flex items-center gap-2 font-medium">
              {formatMonthKey(month)}
              {s && (s.closed ? <Badge tone="green">Đã chốt lương</Badge> : <Badge tone="amber">Tạm tính</Badge>)}
            </span>
          </PeriodNav>

          {!s ? (
            <p className="mb-6 rounded-panel border border-line bg-paper p-4 text-muted">Chưa đọc được dữ liệu lương tháng này.</p>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="grid content-start grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <div className="col-span-2">
                  <Stat
                    tone="brand"
                    icon={<Wallet className="size-4" aria-hidden />}
                    label={s.closed ? 'Lương tháng (đã chốt)' : isCurrent ? 'Lương tạm tính đến hôm nay' : 'Lương tạm tính'}
                    value={formatVnd(s.net_pay)}
                    hint={
                      s.missing_rate > 0
                        ? `${s.missing_rate} ca chưa có mức lương — hỏi chủ sân`
                        : 'Lương giờ + tăng ca + thưởng − khấu trừ'
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Stat
                    icon={<Clock className="size-4" aria-hidden />}
                    label="Giờ công"
                    value={formatMinutes(s.paid_minutes)}
                    hint={`${s.shifts_done} ca đã làm${s.shifts_upcoming > 0 ? ` · còn ${s.shifts_upcoming} ca (${formatMinutes(s.upcoming_minutes)})` : ''}`}
                  />
                </div>
                <Stat
                  tone={s.overtime_count > 0 ? 'good' : 'default'}
                  icon={<Timer className="size-4" aria-hidden />}
                  label="Tăng ca"
                  value={formatVnd(s.overtime_pay)}
                  hint={s.overtime_count > 0 ? `${s.overtime_count} lần · ${formatMinutes(s.overtime_minutes)}` : 'Chưa có'}
                />
                <Stat
                  tone={s.late_count > 0 ? 'bad' : 'default'}
                  icon={<AlarmClock className="size-4" aria-hidden />}
                  label="Đi trễ"
                  value={`${s.late_count} lần`}
                  hint={
                    s.late_count > 0 ? `Tổng ${formatMinutes(s.late_minutes)} (trễ quá ${s.late_grace_minutes} phút)` : 'Đúng giờ cả tháng'
                  }
                />
                <Stat
                  tone={s.forgot_count + s.forgot_checkout_count > 0 ? 'bad' : 'default'}
                  icon={<ScanQrCode className="size-4" aria-hidden />}
                  label="Quên chấm công"
                  value={`${s.forgot_count + s.forgot_checkout_count} lần`}
                  hint={
                    s.pending_fixes > 0
                      ? `${s.pending_fixes} yêu cầu sửa giờ đang chờ duyệt`
                      : s.forgot_checkout_count > 0
                        ? `${s.forgot_checkout_count} lần quên quét ra (tự đóng theo lịch)`
                        : 'Nhớ quét QR khi vào và ra ca'
                  }
                />
                <Stat
                  tone={s.bonus > 0 ? 'good' : 'default'}
                  icon={<BadgePlus className="size-4" aria-hidden />}
                  label="Thưởng"
                  value={formatVnd(s.bonus)}
                />
                <Stat
                  tone={s.penalty > 0 ? 'bad' : 'default'}
                  icon={<BadgeMinus className="size-4" aria-hidden />}
                  label="Phạt / khấu trừ"
                  value={formatVnd(s.penalty)}
                />
                {(s.absent_count > 0 || s.leave_count > 0) && (
                  <div className="col-span-2">
                    <Stat
                      tone={s.absent_count > 0 ? 'bad' : 'default'}
                      icon={<UserX className="size-4" aria-hidden />}
                      label="Vắng / nghỉ phép"
                      value={`${s.absent_count} vắng · ${s.leave_count} nghỉ phép`}
                    />
                  </div>
                )}
              </div>

              <Panel title="Cách tính lương tháng">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Lương giờ thường</dt>
                    <dd className="tabular">{formatVnd(s.regular_pay)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Tăng ca</dt>
                    <dd className="text-court-deep tabular">+ {formatVnd(s.overtime_pay)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Thưởng, phụ cấp</dt>
                    <dd className="text-court-deep tabular">+ {formatVnd(s.bonus)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Phạt, khấu trừ</dt>
                    <dd className="text-shuttle-deep tabular">− {formatVnd(s.penalty)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 border-t border-line pt-3 font-medium">
                    <dt>{s.closed ? 'Thực lĩnh' : 'Tạm tính'}</dt>
                    <dd className="font-display text-xl tabular">{formatVnd(s.net_pay)}</dd>
                  </div>
                </dl>
                {s.adjustments.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-sm">
                    {s.adjustments.map((a) => (
                      <li key={a.id} className="flex justify-between gap-3">
                        <span className="min-w-0">{a.reason}</span>
                        <span className={cn('shrink-0 tabular', a.amount > 0 ? 'text-court-deep' : 'text-shuttle-deep')}>
                          {a.amount > 0 ? '+' : ''}
                          {formatVnd(a.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!s.closed && (
                  <p className="mt-4 text-xs text-muted">Số tạm tính theo công đã chấm; chủ sân chốt lương sau khi hết tháng.</p>
                )}
              </Panel>
            </div>
          )}
        </>
      )}

      <section aria-label="Việc thường làm">
        <h2 className="mb-3 text-xl">Việc thường làm</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {can('payment.record') && (
            <Action
              href="/admin/checkout"
              icon={<CircleDollarSign className="size-5" aria-hidden />}
              label="Thu tiền sân"
              hint="Tiền mặt hoặc chuyển khoản QR, in hóa đơn"
            />
          )}
          {can('sale.record') && (
            <Action
              href="/admin/pos"
              icon={<ShoppingCart className="size-5" aria-hidden />}
              label="Bán hàng"
              hint="Đồ uống, phụ kiện tại quầy"
            />
          )}
          {can('rental.operate') && (
            <Action
              href="/admin/rentals"
              icon={<KeyRound className="size-5" aria-hidden />}
              label="Cho thuê"
              hint="Giao và nhận lại vợt, giày"
            />
          )}
          {can('booking.view') && (
            <Action
              href="/admin/bookings"
              icon={<CalendarDays className="size-5" aria-hidden />}
              label="Lịch đặt sân"
              hint="Khách hôm nay, nhận sân"
            />
          )}
          {ctx.employeeId && (
            <Action
              href="/admin/shifts"
              icon={<CalendarClock className="size-5" aria-hidden />}
              label="Lịch ca"
              hint="Ca của bạn và đồng nghiệp"
            />
          )}
          {ctx.employeeId && (
            <Action
              href="/admin/me"
              icon={<ReceiptText className="size-5" aria-hidden />}
              label="Ca & lương của tôi"
              hint="Phiếu lương, đề nghị tăng ca"
            />
          )}
        </div>
      </section>
    </>
  );
}
