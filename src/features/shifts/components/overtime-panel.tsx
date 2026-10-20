import { Clock3, Handshake, Smartphone } from 'lucide-react';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { Badge } from '@/components/ui/primitives';
import { formatDateTime, formatMinutes, formatTime, formatVnd } from '@/lib/format';

import { cancelOvertimeAction, offerOvertimeAction } from '../actions';
import { baseHourlyRate, isOvertimeStatus, OVERTIME_STATUS, overtimeEndsAt, overtimePay, overtimeWorkedMinutes } from '../lib/overtime';
import { OvertimeOfferForm } from './overtime-offer-form';

interface OvertimeOffer {
  id: string;
  minutes: number;
  hourly_rate: number;
  reason: string;
  status: string;
  consent: string | null;
  requested_at: string;
  responded_at: string | null;
  response_note: string | null;
}

interface OvertimePanelProps {
  shift: {
    id: string;
    status: string;
    scheduled_end: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
    paid_minutes: number | null;
  };
  offers: OvertimeOffer[];
  rate: { pay_type: string; hourly_rate: number | null; daily_rate: number | null; standard_day_minutes: number | null } | null;
  monthClosed: boolean;
  tz: string;
  now: number;
}

function StatusBadge({ status }: { status: string }) {
  const st = isOvertimeStatus(status) ? OVERTIME_STATUS[status] : { label: status, tone: 'neutral' as const };
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

/** Khối tăng ca ở trang chi tiết ca: đề nghị đang hiệu lực, tiền tăng ca thực tế, đề nghị mới, lịch sử. */
export function OvertimePanel({ shift, offers, rate, monthClosed, tz, now }: OvertimePanelProps) {
  const active = offers.find((o) => o.status === 'pending' || o.status === 'accepted') ?? null;
  const past = offers.filter((o) => o !== active);
  const baseHourly = baseHourlyRate(rate);
  const canOffer = !monthClosed && !active && (shift.status === 'scheduled' || shift.status === 'present');
  const scheduledEndMs = new Date(shift.scheduled_end).getTime();

  return (
    <div className="flex flex-col gap-4">
      {active && (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-hall/60 p-3 text-sm">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-xl tabular">
              +{formatMinutes(active.minutes)}
              <span className="ml-2 font-sans text-sm text-muted">
                {formatTime(shift.scheduled_end, tz)}–{formatTime(overtimeEndsAt(shift.scheduled_end, active.minutes), tz)}
              </span>
            </span>
            <StatusBadge status={active.status} />
          </p>
          <p>
            Giá tăng ca <strong className="tabular">{formatVnd(active.hourly_rate)}/giờ</strong>
            {baseHourly !== null && (
              <span className="text-muted">
                {' '}
                (= {Math.round((active.hourly_rate / baseHourly) * 100)}% lương thường {formatVnd(baseHourly)}/giờ)
              </span>
            )}
          </p>
          <p className="text-muted">Lý do: {active.reason}</p>
          {active.status === 'accepted' && (
            <p className="flex items-center gap-1.5 text-court-deep">
              {active.consent === 'in_person' ? (
                <Handshake className="size-4" aria-hidden />
              ) : (
                <Smartphone className="size-4" aria-hidden />
              )}
              {active.consent === 'in_person' ? 'Đồng ý trực tiếp' : 'Nhân viên đồng ý trên ứng dụng'}
              {active.responded_at && ` lúc ${formatDateTime(active.responded_at, tz)}`}
              {active.response_note && ` — “${active.response_note}”`}
            </p>
          )}
          {active.status === 'pending' && (
            <p className="flex items-center gap-1.5 text-amber-deep">
              <Clock3 className="size-4" aria-hidden />
              Gửi lúc {formatDateTime(active.requested_at, tz)}. Nhân viên trả lời được tới{' '}
              {formatTime(overtimeEndsAt(shift.scheduled_end, active.minutes), tz)}.
            </p>
          )}
          {active.status === 'accepted' && (
            <OvertimeEarned shift={shift} minutes={active.minutes} hourlyRate={active.hourly_rate} now={now} />
          )}
          {!monthClosed && (
            <details className="mt-1">
              <summary className="min-h-9 cursor-pointer py-1.5 text-sm font-medium text-shuttle-deep">Hủy tăng ca</summary>
              <ActionForm action={cancelOvertimeAction.bind(null, active.id, shift.id)} confirmMessage="Hủy tăng ca này?" className="gap-2">
                <TextField name="reason" label="Lý do hủy" placeholder="Hết khách, không cần ở lại" required minLength={3} />
                <SubmitButton size="sm" variant="danger" pendingLabel="Đang hủy…">
                  Hủy tăng ca
                </SubmitButton>
              </ActionForm>
            </details>
          )}
        </div>
      )}

      {canOffer && (
        <OvertimeOfferForm
          action={offerOvertimeAction.bind(null, shift.id)}
          baseHourly={baseHourly}
          scheduledEndLabel={formatTime(shift.scheduled_end, tz)}
          scheduledEndMs={scheduledEndMs}
          tz={tz}
          windowPassed={shift.status === 'present' || now >= scheduledEndMs}
        />
      )}
      {!active && !canOffer && (
        <p className="text-sm text-muted">
          {monthClosed ? 'Tháng lương đã chốt — không thay đổi tăng ca được.' : 'Ca đã vắng / nghỉ / hủy nên không tăng ca được.'}
        </p>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Đề nghị trước</p>
          <ul className="divide-y divide-line text-sm">
            {past.map((o) => (
              <li key={o.id} className="flex flex-col gap-0.5 py-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="tabular">
                    +{formatMinutes(o.minutes)} · {formatVnd(o.hourly_rate)}/giờ
                  </span>
                  <StatusBadge status={o.status} />
                </span>
                {o.response_note && <span className="text-muted">{o.response_note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OvertimeEarned({
  shift,
  minutes,
  hourlyRate,
  now,
}: {
  shift: OvertimePanelProps['shift'];
  minutes: number;
  hourlyRate: number;
  now: number;
}) {
  if (!shift.checked_out_at) {
    const pending = now < overtimeEndsAt(shift.scheduled_end, minutes).getTime();
    return (
      <p className="text-muted">
        {pending ? 'Tiền tăng ca được tính khi nhân viên quét QR ra ca.' : 'Chưa có giờ ra ca — điều chỉnh công để tính tăng ca.'} Tối đa{' '}
        {formatVnd(overtimePay(minutes, hourlyRate))}.
      </p>
    );
  }
  const worked = overtimeWorkedMinutes({
    checkedIn: shift.checked_in_at,
    checkedOut: shift.checked_out_at,
    scheduledEnd: shift.scheduled_end,
    approvedMinutes: minutes,
    paidMinutes: shift.paid_minutes,
  });
  return (
    <p className="rounded-control bg-court-soft px-3 py-2 text-court-deep">
      Thực làm tăng ca {formatMinutes(worked)} → <strong className="tabular">{formatVnd(overtimePay(worked, hourlyRate))}</strong>
      {worked < minutes && <span className="block text-xs">Về sớm hơn khung tăng ca nên chỉ tính phần đã làm.</span>}
    </p>
  );
}
