import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, DescriptionList, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import { decideActualTimeAction } from '@/features/attendance/actions';
import { ActualTimeDecision, FixDecision } from '@/features/attendance/components/review-actions';
import { FIX_STATUS, lateMinutes, lateOutMinutes, paidWindow, SOURCE_LABEL } from '@/features/attendance/lib/rules';
import { getAttendanceSettings } from '@/features/attendance/queries';
import { adjustAttendanceAction, rescheduleShiftAction } from '@/features/shifts/actions';
import { OvertimePanel } from '@/features/shifts/components/overtime-panel';
import { overtimeEndsAt } from '@/features/shifts/lib/overtime';
import { plannedMinutes } from '@/features/shifts/lib/shift-time';
import { getShift } from '@/features/shifts/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
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
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [, [data, rules]] = await withGuard(requireOwner(), () => Promise.all([getShift(id), getAttendanceSettings()]));
  if (!data) notFound();
  const { shift: s, history, overtime, fixes, rate, monthClosed } = data;
  const tz = s.branches?.timezone ?? DEFAULT_TZ;
  const started = s.checked_in_at !== null;
  const acceptedOt = overtime.find((o) => o.status === 'accepted');
  // Có tăng ca đã đồng ý thì giờ ra gợi ý = hết khung tăng ca.
  const expectedOut = acceptedOt ? overtimeEndsAt(s.scheduled_end, acceptedOt.minutes).toISOString() : s.scheduled_end;
  const otMinutes = acceptedOt?.minutes ?? 0;
  const paidSpan = paidWindow(s, otMinutes);
  const late = lateMinutes(s, rules.late_grace_minutes);
  const lateOut = lateOutMinutes(s, otMinutes);
  const timeWithSource = (at: string | null, scanned: string | null, source: string | null) =>
    at ? (
      <span className="flex flex-col">
        <span>{formatDateTime(at, tz)}</span>
        <span className="text-sm font-normal text-muted">
          {source ? (SOURCE_LABEL[source] ?? source) : ''}
          {scanned && scanned !== at ? ` · quét QR lúc ${formatTime(scanned, tz)}` : ''}
        </span>
      </span>
    ) : (
      '—'
    );

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
                { label: 'Vào ca', value: timeWithSource(s.checked_in_at, s.scanned_in_at, s.in_source) },
                { label: 'Ra ca', value: timeWithSource(s.checked_out_at, s.scanned_out_at, s.out_source) },
                {
                  label: 'Khung tính công',
                  value: paidSpan ? (
                    <span className="flex flex-col">
                      <span className="tabular">
                        {formatTime(new Date(paidSpan.start), tz)}–{formatTime(new Date(paidSpan.end), tz)}
                      </span>
                      <span className="text-sm font-normal text-muted">
                        {s.actual_time_decision === 'approved'
                          ? 'Trả theo giờ thực tế (chủ sân đã duyệt)'
                          : paidSpan.capped
                            ? 'Đã giới hạn trong khung ca + tăng ca đã đồng ý'
                            : 'Trong khung ca'}
                      </span>
                    </span>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: 'Công tính lương',
                  value: <span className="font-display text-xl tabular">{formatMinutes(s.paid_minutes ?? 0)}</span>,
                },
                { label: 'Ghi chú', value: s.note ?? '—' },
              ]}
            />
          </Panel>
          {(late > 0 || s.out_source === 'auto' || lateOut > 0 || s.actual_time_decision) && (
            <Panel title="Cần chú ý">
              <ul className="flex flex-col gap-3">
                {late > 0 && (
                  <li className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">Đi trễ {late} phút</Badge>
                    <span className="text-sm text-muted">Ân hạn {rules.late_grace_minutes} phút. Chỉ để theo dõi, không tự trừ tiền.</span>
                  </li>
                )}
                {s.out_source === 'auto' && (
                  <li className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">Quên quét ra — tự đóng theo lịch</Badge>
                    <span className="text-sm text-muted">Nhân viên có thể gửi yêu cầu sửa giờ ra nếu ở lại muộn hơn.</span>
                  </li>
                )}
                {lateOut > 0 && (
                  <li className="flex flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={s.actual_time_decision === 'approved' ? 'green' : 'neutral'}>
                        Ra muộn hơn khung {formatMinutes(lateOut)}
                      </Badge>
                      <span className="text-sm text-muted">
                        {s.actual_time_decision === 'approved'
                          ? 'Đang trả theo giờ thực tế.'
                          : s.actual_time_decision === 'kept'
                            ? 'Đã xem — giữ công theo khung ca.'
                            : 'Công đang tính tới hết khung. Trả thêm chỉ khi nhân viên ở lại làm thật.'}
                      </span>
                    </span>
                    {!monthClosed && s.status === 'present' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {s.actual_time_decision !== 'approved' && s.actual_time_decision !== 'kept' && (
                          <ActualTimeDecision shiftId={s.id} />
                        )}
                        {s.actual_time_decision && (
                          <ActionButton
                            action={decideActualTimeAction.bind(null, s.id, null)}
                            label="Bỏ quyết định"
                            variant="ghost"
                            hidden={{ reason: 'Xem lại quyết định giờ thực tế' }}
                          />
                        )}
                      </div>
                    )}
                  </li>
                )}
              </ul>
            </Panel>
          )}
          {fixes.length > 0 && (
            <Panel title="Yêu cầu sửa giờ của nhân viên">
              <ul className="divide-y divide-line">
                {fixes.map((f) => (
                  <li key={f.id} className="flex flex-col gap-2 py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={FIX_STATUS[f.status]?.tone ?? 'neutral'}>{FIX_STATUS[f.status]?.label ?? f.status}</Badge>
                      <span>
                        Giờ {f.kind === 'in' ? 'vào' : 'ra'}: {f.recorded_at ? formatTime(f.recorded_at, tz) : 'chưa có'} →{' '}
                        <strong className="tabular">{formatTime(f.claimed_at, tz)}</strong>
                      </span>
                      <span className="text-sm text-muted">gửi {formatDateTime(f.created_at, tz)}</span>
                    </span>
                    <span className="text-sm">“{f.reason}”</span>
                    {f.decision_note && <span className="text-sm text-muted">Chủ sân: {f.decision_note}</span>}
                    {f.status === 'pending' && !monthClosed && <FixDecision requestId={f.id} />}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
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
