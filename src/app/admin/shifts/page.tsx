import { PeriodNav } from '@/components/ui/day-nav';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Disclosure, PageHeader } from '@/components/ui/primitives';
import { createShiftAction } from '@/features/shifts/actions';
import { WeekBoard } from '@/features/shifts/components/week-board';
import { getWeekShifts, listSchedulableEmployees } from '@/features/shifts/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { formatDateKey } from '@/lib/format';
import { halfHourOptions } from '@/lib/options';
import { addDays, DEFAULT_TZ, isDateKey, startOfIsoWeek, todayKey } from '@/lib/time';

export const metadata = { title: 'Lịch ca' };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { ctx, branch } = await requireBranchPermission('shift.view_branch');
  const { week } = await searchParams;
  const today = todayKey();
  const weekStart = startOfIsoWeek(week && isDateKey(week) ? week : today);
  const owner = isOwner(ctx);
  const [{ branch: info, shifts }, employees] = await Promise.all([
    getWeekShifts(branch.branchId, weekStart),
    owner ? listSchedulableEmployees() : Promise.resolve([]),
  ]);
  const tz = info?.timezone ?? DEFAULT_TZ;
  const homeFirst = [...employees].sort(
    (a, b) => Number(b.home_branch_id === branch.branchId) - Number(a.home_branch_id === branch.branchId),
  );

  return (
    <>
      <PageHeader title="Lịch ca" description={`${branch.name}. Tuần từ ${formatDateKey(weekStart)}.`} />
      <PeriodNav
        prevHref={`/admin/shifts?week=${addDays(weekStart, -7)}`}
        nextHref={`/admin/shifts?week=${addDays(weekStart, 7)}`}
        prevLabel="Tuần trước"
        nextLabel="Tuần sau"
        currentHref="/admin/shifts"
        currentLabel="Tuần này"
      />

      {owner && (
        <div className="mb-6">
          <Disclosure summary="Xếp ca mới">
            <ActionForm action={createShiftAction} className="max-w-xl">
              <input type="hidden" name="branch_id" value={branch.branchId} />
              <SelectField
                name="employee_id"
                label="Nhân viên"
                placeholder="Chọn nhân viên"
                options={homeFirst.map((e) => ({ value: e.id, label: `${e.full_name} (${e.code})` }))}
                required
              />
              <TextField
                name="work_date"
                label="Ngày bắt đầu ca"
                type="date"
                defaultValue={today >= weekStart && today < addDays(weekStart, 7) ? today : weekStart}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField name="start" label="Vào ca" defaultValue="06:00" options={halfHourOptions()} />
                <SelectField name="end" label="Ra ca" defaultValue="14:00" options={halfHourOptions()} />
              </div>
              <p className="-mt-2 text-sm text-muted">Giờ ra sớm hơn giờ vào nghĩa là ca qua nửa đêm.</p>
              <TextField name="break_minutes" label="Phút nghỉ giữa ca" type="number" min={0} max={240} defaultValue={0} />
              <TextField
                name="repeat_days"
                label="Lặp liên tiếp (số ngày)"
                type="number"
                min={1}
                max={14}
                defaultValue={1}
                hint="Ví dụ 6 để xếp cùng giờ từ thứ Hai đến thứ Bảy."
              />
              <TextField name="note" label="Ghi chú" optional />
              <SubmitButton size="sm">Xếp ca</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      )}

      <WeekBoard weekStart={weekStart} shifts={shifts} tz={tz} today={today} linkable={owner} />
    </>
  );
}
