import { Hourglass } from 'lucide-react';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { describeDateKey, formatMinutes, formatTime, formatVnd } from '@/lib/format';

import { respondOvertimeAction } from '../actions';
import { overtimeEndsAt, overtimePay } from '../lib/overtime';

interface OvertimeRequestCardProps {
  offer: { id: string; minutes: number; hourly_rate: number; reason: string };
  shift: { work_date: string; scheduled_start: string; scheduled_end: string; branchName: string | null };
  tz: string | undefined;
}

/** Thẻ đề nghị tăng ca cho nhân viên: thấy rõ ở lại tới mấy giờ, giá bao nhiêu, được thêm bao nhiêu tiền. */
export function OvertimeRequestCard({ offer, shift, tz }: OvertimeRequestCardProps) {
  const day = describeDateKey(shift.work_date);
  const endsAt = overtimeEndsAt(shift.scheduled_end, offer.minutes);
  return (
    <li className="flex flex-col gap-3 rounded-panel border-2 border-amber-deep/40 bg-amber-soft p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-amber-deep" aria-hidden>
          <Hourglass className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            Đề nghị ở lại thêm {formatMinutes(offer.minutes)} — tới {formatTime(endsAt, tz)}
          </p>
          <p className="text-sm text-muted">
            Ca {day.weekdayShort} {day.dayMonth}, {formatTime(shift.scheduled_start, tz)}–{formatTime(shift.scheduled_end, tz)}
            {shift.branchName ? `, ${shift.branchName}` : ''}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 rounded-control bg-paper p-3 text-sm">
        <div>
          <dt className="text-muted">Giá tăng ca</dt>
          <dd className="font-medium tabular">{formatVnd(offer.hourly_rate)}/giờ</dd>
        </div>
        <div>
          <dt className="text-muted">Nhận thêm nếu làm đủ</dt>
          <dd className="font-display text-xl text-court-deep tabular">{formatVnd(overtimePay(offer.minutes, offer.hourly_rate))}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Lý do</dt>
          <dd>{offer.reason}</dd>
        </div>
      </dl>
      <ActionForm action={respondOvertimeAction.bind(null, offer.id)} className="gap-3">
        <TextField name="note" label="Nhắn lại quản lý" optional placeholder="Em ở lại được tới 13h" maxLength={300} />
        <div className="grid grid-cols-2 gap-2">
          <SubmitButton name="decision" value="accept" variant="court" pendingLabel="Đang gửi…">
            Đồng ý
          </SubmitButton>
          <SubmitButton name="decision" value="decline" variant="outline" pendingLabel="Đang gửi…">
            Từ chối
          </SubmitButton>
        </div>
      </ActionForm>
      <p className="text-xs text-muted">
        Trả lời được tới {formatTime(endsAt, tz)}. Đồng ý thì nhớ quét QR ra ca lúc về để tính tiền tăng ca.
      </p>
    </li>
  );
}
