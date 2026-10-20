import { AutoRefresh } from '@/components/ui/auto-refresh';
import { PeriodNav } from '@/components/ui/day-nav';
import { PageHeader } from '@/components/ui/primitives';
import { OnDutyStrip } from '@/features/shifts/components/on-duty-strip';
import { ShiftPlanner } from '@/features/shifts/components/shift-planner';
import { templatesFrom } from '@/features/shifts/lib/plan';
import { redirect } from 'next/navigation';

import { getMyWeekShifts, getWeekShifts, listSchedulableEmployees } from '@/features/shifts/queries';
import { getActiveBranch } from '@/lib/auth/context';
import { requireStaff } from '@/lib/auth/guards';
import { hasPermission, isOwner } from '@/lib/auth/permissions';
import { formatDateKey } from '@/lib/format';
import { addDays, DEFAULT_TZ, isDateKey, requestNow, startOfIsoWeek, timeInZone, todayKey } from '@/lib/time';

export const metadata = { title: 'Lịch ca' };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const ctx = await requireStaff();
  const owner = isOwner(ctx);
  // Có quyền xem lịch chi nhánh → cả chi nhánh (kèm tên đồng nghiệp); không có → ca của chính mình.
  const branch = (await getActiveBranch(ctx, owner ? undefined : 'shift.view_branch')) ?? (await getActiveBranch(ctx));
  const canBranch = Boolean(branch && (owner || hasPermission(ctx, 'shift.view_branch', branch.branchId)));
  if (!canBranch && !ctx.employeeId) redirect('/admin/denied');
  const { week } = await searchParams;
  const today = todayKey();
  const weekStart = startOfIsoWeek(week && isDateKey(week) ? week : today);
  const [{ branch: info, shifts }, employees] = await Promise.all([
    canBranch && branch
      ? getWeekShifts(branch.branchId, weekStart, { colleagues: !owner })
      : getMyWeekShifts(ctx.employeeId ?? '', weekStart).then((rows) => ({ branch: null, shifts: rows })),
    owner ? listSchedulableEmployees() : Promise.resolve([]),
  ]);
  const tz = info?.timezone ?? DEFAULT_TZ;
  const now = requestNow();
  const thisWeek = today >= weekStart && today < addDays(weekStart, 7);
  const templates = templatesFrom(
    shifts.map((s) => ({ start: timeInZone(new Date(s.scheduled_start), tz), end: timeInZone(new Date(s.scheduled_end), tz) })),
  );

  return (
    <>
      <PageHeader
        title={canBranch ? 'Lịch ca' : 'Lịch ca của tôi'}
        description={`${canBranch && branch ? branch.name : 'Ca của bạn ở mọi chi nhánh'}. Tuần từ ${formatDateKey(weekStart)}.`}
      />
      <PeriodNav
        prevHref={`/admin/shifts?week=${addDays(weekStart, -7)}`}
        nextHref={`/admin/shifts?week=${addDays(weekStart, 7)}`}
        prevLabel="Tuần trước"
        nextLabel="Tuần sau"
        currentHref="/admin/shifts"
        currentLabel="Tuần này"
      />
      {thisWeek && (
        <>
          <AutoRefresh intervalMs={120_000} />
          <OnDutyStrip shifts={shifts.filter((s) => s.work_date >= addDays(today, -1) && s.work_date <= today)} tz={tz} now={now} />
        </>
      )}
      <ShiftPlanner
        branchId={branch?.branchId ?? ''}
        tz={tz}
        weekStart={weekStart}
        today={today}
        nowMs={now}
        shifts={shifts}
        templates={templates}
        canEdit={owner}
        employees={employees
          .map((e) => ({
            id: e.id,
            code: e.code,
            full_name: e.full_name,
            homeHere: e.home_branch_id === branch?.branchId,
            hasRate: e.employee_pay_rates.length > 0,
          }))
          .sort((a, b) => Number(b.homeHere) - Number(a.homeHere))}
      />
    </>
  );
}
