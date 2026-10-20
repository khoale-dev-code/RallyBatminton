import { ActionButton } from '@/components/ui/action-button';
import { LinkButton } from '@/components/ui/button';
import { Badge, Disclosure, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { cancelFixAction } from '@/features/attendance/actions';
import { FixRequestForm } from '@/features/attendance/components/fix-request-form';
import { canRequestFix, FIX_STATUS, lateMinutes, lateOutMinutes } from '@/features/attendance/lib/rules';
import { getAttendanceSettings } from '@/features/attendance/queries';
import { getMyOverview } from '@/features/me/queries';
import { OvertimeRequestCard } from '@/features/shifts/components/overtime-request-card';
import { requireStaff } from '@/lib/auth/guards';
import { describeDateKey, formatMinutes, formatMonthKey, formatTime, formatVnd } from '@/lib/format';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { requestNow, todayKey } from '@/lib/time';

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
  const [{ employee, shifts, payslips, rate, adjustments }, rules] = await Promise.all([
    getMyOverview(ctx.employeeId, today),
    getAttendanceSettings(),
  ]);
  const upcoming = shifts.filter((s) => s.work_date >= today);
  const past = shifts.filter((s) => s.work_date < today).reverse();
  const now = requestNow();
  // Đề nghị tăng ca còn hạn trả lời (trước khi hết khung giờ tăng ca).
  const requests = shifts.flatMap((s) =>
    s.shift_overtime
      .filter((o) => o.status === 'pending' && new Date(s.scheduled_end).getTime() + o.minutes * 60000 > now)
      .map((o) => ({ offer: o, shift: s })),
  );

  const shiftRow = (s: (typeof shifts)[number]) => {
    const tz = s.branches?.timezone;
    const info = describeDateKey(s.work_date);
    const ot = s.shift_overtime.find((o) => o.status === 'accepted')?.minutes ?? 0;
    const late = lateMinutes(s, rules.late_grace_minutes);
    const lateOut = s.out_source === 'qr' && !s.actual_time_decision ? lateOutMinutes(s, ot) : 0;
    const fixes = [...s.attendance_fix_requests].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pendingKinds = new Set(fixes.filter((f) => f.status === 'pending').map((f) => f.kind));
    const started = new Date(s.scheduled_start).getTime() - 60 * 60_000 <= now;
    const fixable = started && (s.status === 'scheduled' || s.status === 'present') && canRequestFix(s, rules.fix_request_hours, now);
    // Đã có giờ vào thì chỉ khai được giờ vào SỚM hơn hoặc giờ ra; chưa có giờ vào thì khai giờ vào trước.
    const kinds = (['in', 'out'] as const).filter(
      (k) =>
        !pendingKinds.has(k) &&
        (k === 'in' ||
          ((s.checked_in_at !== null || pendingKinds.has('in')) &&
            (s.checked_out_at !== null || new Date(s.scheduled_end).getTime() <= now))),
    );
    return (
      <li key={s.id} className="flex flex-col gap-2 py-3">
        <div className="flex items-center justify-between gap-3">
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
              {s.checked_in_at ? ` · vào ${formatTime(s.checked_in_at, tz)}` : ''}
              {s.checked_out_at ? ` · ra ${formatTime(s.checked_out_at, tz)}` : ''}
              {s.status === 'present' ? ` · công ${formatMinutes(s.paid_minutes)}` : ''}
            </span>
            {s.shift_overtime
              .filter((o) => o.status === 'accepted')
              .map((o) => (
                <span key={o.id} className="text-sm text-court-deep">
                  Tăng ca +{formatMinutes(o.minutes)}, {formatVnd(o.hourly_rate)}/giờ
                </span>
              ))}
          </span>
          <Badge tone={ATTENDANCE_STATUS[s.status].tone}>
            {s.status === 'scheduled' && s.checked_in_at ? 'Đang làm' : ATTENDANCE_STATUS[s.status].label}
          </Badge>
        </div>
        {(late > 0 || s.out_source === 'auto' || lateOut > 0) && (
          <p className="flex flex-wrap gap-1.5 text-xs">
            {late > 0 && <Badge tone="amber">Trễ {late} phút</Badge>}
            {s.out_source === 'auto' && <Badge tone="amber">Quên ra ca — đã tự đóng theo lịch</Badge>}
            {lateOut > 0 && <Badge tone="neutral">Ra muộn {formatMinutes(lateOut)} — công tính tới hết khung ca</Badge>}
          </p>
        )}
        {fixes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {fixes.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-control bg-hall/70 px-3 py-2 text-sm">
                <Badge tone={FIX_STATUS[f.status]?.tone ?? 'neutral'}>{FIX_STATUS[f.status]?.label ?? f.status}</Badge>
                <span>
                  Sửa giờ {f.kind === 'in' ? 'vào' : 'ra'} thành <strong className="tabular">{formatTime(f.claimed_at, tz)}</strong>
                </span>
                {f.decision_note && <span className="text-muted">— {f.decision_note}</span>}
                {f.status === 'pending' && (
                  <span className="ml-auto">
                    <ActionButton action={cancelFixAction.bind(null, f.id)} label="Rút yêu cầu" variant="ghost" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {fixable && kinds.length > 0 && (
          <Disclosure summary="Quên chấm công? Gửi yêu cầu sửa giờ">
            <FixRequestForm
              shiftId={s.id}
              kinds={[...kinds]}
              defaults={{ in: formatTime(s.scheduled_start, tz), out: formatTime(s.scheduled_end, tz) }}
            />
          </Disclosure>
        )}
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
      {requests.length > 0 && (
        <section aria-label="Đề nghị tăng ca" className="mb-6">
          <h2 className="mb-3 text-xl">Đề nghị tăng ca ({requests.length})</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {requests.map(({ offer, shift }) => (
              <OvertimeRequestCard
                key={offer.id}
                offer={offer}
                shift={{ ...shift, branchName: shift.branches?.name ?? null }}
                tz={shift.branches?.timezone}
              />
            ))}
          </ul>
        </section>
      )}
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
                        {p.overtime_minutes > 0 ? `, tăng ca ${formatMinutes(p.overtime_minutes)} (${formatVnd(p.overtime_pay)})` : ''}
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
