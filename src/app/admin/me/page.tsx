import { LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { getMyOverview } from '@/features/me/queries';
import { requireStaff } from '@/lib/auth/guards';
import { describeDateKey, formatMinutes, formatMonthKey, formatTime, formatVnd } from '@/lib/format';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Ca & lương của tôi' };

export default async function MyPage() {
  const ctx = await requireStaff();
  if (!ctx.employeeId) {
    return (
      <>
        <PageHeader title="Ca & lương của tôi" />
        <EmptyState title="Tài khoản này không gắn hồ sơ nhân viên" />
      </>
    );
  }
  const today = todayKey();
  const { employee, shifts, payslips, rate, adjustments } = await getMyOverview(ctx.employeeId, today);
  const upcoming = shifts.filter((s) => s.work_date >= today);
  const past = shifts.filter((s) => s.work_date < today).reverse();

  const shiftRow = (s: (typeof shifts)[number]) => {
    const tz = s.branches?.timezone;
    const info = describeDateKey(s.work_date);
    return (
      <li key={s.id} className="flex items-center justify-between gap-3 py-3">
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">
            {info.weekdayShort} {info.dayMonth}
            <span className="font-normal tabular">
              {' '}
              {formatTime(s.scheduled_start, tz)}–{formatTime(s.scheduled_end, tz)}
            </span>
          </span>
          <span className="text-sm text-muted">
            {s.branches?.name}
            {s.status === 'present' ? `, công ${formatMinutes(s.paid_minutes ?? 0)}` : ''}
          </span>
        </span>
        <Badge tone={ATTENDANCE_STATUS[s.status].tone}>
          {s.status === 'scheduled' && s.checked_in_at ? 'Đang làm' : ATTENDANCE_STATUS[s.status].label}
        </Badge>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Ca & lương của tôi"
        description={employee ? `${employee.full_name}, ${employee.code}, ${employee.branches?.name ?? ''}` : undefined}
        actions={
          <LinkButton href="/checkin" variant="court">
            Chấm công
          </LinkButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ca sắp tới">
          {upcoming.length === 0 ? (
            <p className="text-muted">Chưa có ca được xếp.</p>
          ) : (
            <ul className="divide-y divide-line">{upcoming.map(shiftRow)}</ul>
          )}
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Lương">
            {rate && (
              <p className="mb-4 text-sm text-muted">
                Mức hiện tại:{' '}
                <span className="text-ink tabular">
                  {rate.pay_type === 'hourly' ? `${formatVnd(rate.hourly_rate)}/giờ` : `${formatVnd(rate.daily_rate)}/ngày công`}
                </span>
              </p>
            )}
            {payslips.length === 0 ? (
              <p className="text-muted">Chưa có tháng lương nào được chốt.</p>
            ) : (
              <ul className="divide-y divide-line">
                {payslips.map((p) => (
                  <li key={p.period_id} className="flex items-baseline justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <span>{p.payroll_periods ? formatMonthKey(p.payroll_periods.month) : ''}</span>
                      <span className="text-sm text-muted">
                        {p.shifts_count} ca, {formatMinutes(p.paid_minutes)}
                        {p.adjustments_total !== 0 ? `, điều chỉnh ${formatVnd(p.adjustments_total)}` : ''}
                      </span>
                    </span>
                    <span className="font-display text-xl tabular">{formatVnd(p.net_pay)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {adjustments.length > 0 && (
            <Panel title="Thưởng và khấu trừ gần đây">
              <ul className="divide-y divide-line">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 py-2">
                    <span className="text-sm">
                      {formatMonthKey(a.month)}: {a.reason}
                    </span>
                    <span className="tabular">
                      {a.amount > 0 ? '+' : ''}
                      {formatVnd(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Ca đã làm (14 ngày)">
            {past.length === 0 ? <p className="text-muted">Chưa có.</p> : <ul className="divide-y divide-line">{past.map(shiftRow)}</ul>}
          </Panel>
        </div>
      </div>
    </>
  );
}
