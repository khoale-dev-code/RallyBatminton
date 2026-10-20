import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, DescriptionList, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import { adjustAttendanceAction, rescheduleShiftAction } from '@/features/shifts/actions';
import { OvertimePanel } from '@/features/shifts/components/overtime-panel';
import { overtimeEndsAt } from '@/features/shifts/lib/overtime';
import { plannedMinutes } from '@/features/shifts/lib/shift-time';
import { getShift } from '@/features/shifts/queries';
import { requireOwner } from '@/lib/auth/guards';
import { formatDateKey, formatDateTime, formatMinutes, formatTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { ATTENDANCE_STATUS } from '@/lib/labels';
import { halfHourOptions } from '@/lib/options';
import { dateKeyInZone, DEFAULT_TZ, requestNow, timeInZone } from '@/lib/time';

function toLocalInput(value: string | null, tz: string): string {
  if (!value) return '';
  const d = new Date(value);
  return `${dateKeyInZone(d, tz)}T${timeInZone(d, tz)}`;
}

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getShift(id);
  if (!data) notFound();
  const { shift: s, history, overtime, rate, monthClosed } = data;
  const tz = s.branches?.timezone ?? DEFAULT_TZ;
  const started = s.checked_in_at !== null;
  const acceptedOt = overtime.find((o) => o.status === 'accepted');
  // Có tăng ca đã đồng ý thì giờ ra gợi ý = hết khung tăng ca.
  const expectedOut = acceptedOt ? overtimeEndsAt(s.scheduled_end, acceptedOt.minutes).toISOString() : s.scheduled_end;

  return (
    <>
      <PageHeader
        title={s.employees?.full_name ?? 'Ca làm'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {s.branches?.name}, {formatDateKey(s.work_date)}
            <Badge tone={ATTENDANCE_STATUS[s.status].tone}>{ATTENDANCE_STATUS[s.status].label}</Badge>
          </span>
        }
        back={
          <Link href={`/admin/shifts?week=${s.work_date}`} className="text-sm text-muted hover:underline">
            Lịch ca
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <DescriptionList
              items={[
                {
                  label: 'Lịch',
                  value: `${formatTime(s.scheduled_start, tz)}–${formatTime(s.scheduled_end, tz)}, nghỉ ${s.break_minutes} phút`,
                },
                { label: 'Dự kiến', value: formatMinutes(plannedMinutes(s.scheduled_start, s.scheduled_end, s.break_minutes)) },
                { label: 'Vào ca', value: s.checked_in_at ? formatDateTime(s.checked_in_at, tz) : '—' },
                { label: 'Ra ca', value: s.checked_out_at ? formatDateTime(s.checked_out_at, tz) : '—' },
                {
                  label: 'Công tính lương',
                  value: <span className="font-display text-xl tabular">{formatMinutes(s.paid_minutes ?? 0)}</span>,
                },
                { label: 'Ghi chú', value: s.note ?? '—' },
              ]}
            />
          </Panel>
          <Panel title="Nhật ký thay đổi" description="Mọi lần quét QR và chỉnh công đều được ghi lại cùng lý do.">
            {history.length === 0 ? (
              <p className="text-muted">Chưa có thay đổi.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5 py-3">
                    <span className="text-sm text-muted">{formatDateTime(h.occurred_at, tz)}</span>
                    <span>{h.action === 'INSERT' ? 'Tạo ca' : (h.reason ?? 'Cập nhật lịch')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel
            title="Tăng ca"
            description="Đề nghị nhân viên ở lại sau giờ ra ca với giá riêng. Chỉ tính khi nhân viên đồng ý; phần làm thêm tính theo giá tăng ca."
          >
            <OvertimePanel shift={s} offers={overtime} rate={rate} monthClosed={monthClosed} tz={tz} now={requestNow()} />
          </Panel>
          <Panel title="Điều chỉnh công" description="Chỉ chủ sân. Bắt buộc ghi lý do; không sửa được ca thuộc tháng đã chốt lương.">
            <ActionForm action={adjustAttendanceAction.bind(null, s.id)} confirmMessage="Lưu điều chỉnh công cho ca này?">
              <SelectField
                name="status"
                label="Kết quả"
                defaultValue={s.status === 'scheduled' ? 'present' : s.status}
                options={(['present', 'absent', 'leave', 'cancelled'] as const).map((k) => ({
                  value: k,
                  label: ATTENDANCE_STATUS[k].label,
                }))}
              />
              <TextField
                name="checked_in_at"
                label="Giờ vào thực tế"
                type="datetime-local"
                defaultValue={toLocalInput(s.checked_in_at ?? s.scheduled_start, tz)}
                hint="Chỉ dùng khi Có mặt."
              />
              <TextField
                name="checked_out_at"
                label="Giờ ra thực tế"
                type="datetime-local"
                defaultValue={toLocalInput(s.checked_out_at ?? expectedOut, tz)}
              />
              <TextField
                name="actual_break_minutes"
                label="Phút nghỉ thực tế"
                type="number"
                min={0}
                max={240}
                defaultValue={s.actual_break_minutes || s.break_minutes}
              />
              <TextField name="reason" label="Lý do" required minLength={5} placeholder="Quên quét QR lúc ra ca" />
              <SubmitButton>Lưu điều chỉnh</SubmitButton>
            </ActionForm>
          </Panel>
          {!started && s.status === 'scheduled' && (
            <Disclosure summary="Đổi lịch ca">
              <ActionForm action={rescheduleShiftAction.bind(null, s.id)}>
                <TextField name="work_date" label="Ngày" type="date" defaultValue={s.work_date} required />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    name="start"
                    label="Vào ca"
                    defaultValue={timeInZone(new Date(s.scheduled_start), tz)}
                    options={halfHourOptions()}
                  />
                  <SelectField
                    name="end"
                    label="Ra ca"
                    defaultValue={timeInZone(new Date(s.scheduled_end), tz)}
                    options={halfHourOptions()}
                  />
                </div>
                <TextField name="break_minutes" label="Phút nghỉ" type="number" min={0} max={240} defaultValue={s.break_minutes} />
                <TextField name="note" label="Ghi chú" defaultValue={s.note ?? ''} optional />
                <SubmitButton size="sm" variant="outline">
                  Lưu lịch
                </SubmitButton>
              </ActionForm>
            </Disclosure>
          )}
        </div>
      </div>
    </>
  );
}
