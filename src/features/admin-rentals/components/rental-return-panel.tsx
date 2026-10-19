'use client';

import { useState } from 'react';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { formatTime, formatVnd } from '@/lib/format';
import { formatBlock, formatSpan, type OvertimePolicy } from '@/lib/rental-fee';

import { returnRentalAction } from '../actions';
import { useNow } from '../hooks/use-now';
import { rentalLiveState, type RentalLiveState } from '../lib/rental-status';

import { RentalTimeMeter } from './rental-time-meter';

interface LiveProps {
  startsAt: string;
  dueAt: string;
  quantity: number;
  policy: OvertimePolicy;
  serverNow: number;
}

/** Diễn giải phụ phí theo từng bước để nhân viên đọc cho khách. */
export function OvertimeExplain({
  state,
  policy,
  quantity,
  dueAt,
}: {
  state: RentalLiveState;
  policy: OvertimePolicy;
  quantity: number;
  dueAt: string;
}) {
  const graceEnd = new Date(new Date(dueAt).getTime() + policy.graceMinutes * 60000);
  if (state.phase === 'ok' || state.phase === 'soon') {
    return (
      <p className="text-sm text-muted">
        Còn {formatSpan(state.minutesLeft)} tới hạn trả. Trả trễ quá ân hạn ({formatTime(graceEnd)}) mới tính {formatVnd(policy.blockPrice)}{' '}
        mỗi {formatBlock(policy.blockMinutes)} cho 1 món.
      </p>
    );
  }
  if (state.phase === 'grace') {
    return (
      <p className="text-sm text-amber-deep">
        Đang trong ân hạn {formatSpan(policy.graceMinutes)} (đến {formatTime(graceEnd)}): nhận trả bây giờ chưa tính phụ phí.
      </p>
    );
  }
  const { overtime } = state;
  return (
    <div className="flex flex-col gap-1 rounded-control bg-shuttle-soft px-3 py-2.5 text-sm">
      <span className="text-shuttle-deep">
        Trễ <strong className="font-medium">{formatSpan(overtime.lateMinutes)}</strong> (quá ân hạn {formatSpan(policy.graceMinutes)}) →{' '}
        {overtime.blocks} block {formatBlock(policy.blockMinutes)} × {formatVnd(policy.blockPrice)}
        {quantity > 1 ? ` × ${quantity} món` : ''}
      </span>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-muted">
          {overtime.capped ? `Đã chạm trần ${formatVnd((policy.cap ?? 0) * quantity)}` : 'Phụ phí tạm tính'}
        </span>
        <span className="font-display text-2xl text-shuttle-deep tabular">{formatVnd(overtime.fee)}</span>
      </span>
    </div>
  );
}

/** Thời gian + phụ phí sống trên trang chi tiết (phiếu đang thuê). */
export function RentalLiveStatus(props: LiveProps) {
  const now = useNow(props.serverNow);
  const state = rentalLiveState(props, now);
  return (
    <div className="flex flex-col gap-3">
      <RentalTimeMeter startsAt={props.startsAt} dueAt={props.dueAt} state={state} />
      <OvertimeExplain state={state} policy={props.policy} quantity={props.quantity} dueAt={props.dueAt} />
    </div>
  );
}

interface ReturnLine {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
}

/** Form nhận trả: số lượng tốt/hư/mất, phụ phí trễ theo hệ thống hoặc giảm (bắt buộc lý do), phí hư hỏng. */
export function RentalReturnForm({ rentalId, lines, ...live }: LiveProps & { rentalId: string; lines: ReturnLine[] }) {
  const now = useNow(live.serverNow);
  const state = rentalLiveState(live, now);
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const hasLateFee = state.overtime.fee > 0;

  return (
    <ActionForm action={returnRentalAction.bind(null, rentalId)} confirmMessage="Xác nhận nhận trả phiếu này?">
      {lines.map((l) => (
        <fieldset key={l.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
          <legend className="px-1 text-sm font-medium">
            {l.label} <span className="text-muted tabular">(giao {l.quantity})</span>
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <TextField name={`returned_${l.variantId}`} label="Trả tốt" type="number" min={0} max={l.quantity} defaultValue={l.quantity} />
            <TextField name={`damaged_${l.variantId}`} label="Hư" type="number" min={0} max={l.quantity} defaultValue={0} />
            <TextField name={`lost_${l.variantId}`} label="Mất" type="number" min={0} max={l.quantity} defaultValue={0} />
          </div>
        </fieldset>
      ))}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Phụ phí trả trễ</legend>
        <input type="hidden" name="late_mode" value={hasLateFee ? mode : 'auto'} />
        {hasLateFee ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'auto', title: `Thu theo hệ thống`, sub: `≈ ${formatVnd(state.overtime.fee)}, tính chính xác lúc bấm nhận` },
                { id: 'custom', title: 'Giảm hoặc miễn', sub: 'Nhập số tiền thu và lý do' },
              ] as const
            ).map((o) => (
              <label
                key={o.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
                  mode === o.id ? 'border-ink bg-hall/60' : 'border-line hover:bg-hall/40',
                )}
              >
                <input
                  type="radio"
                  name="late_mode_choice"
                  value={o.id}
                  checked={mode === o.id}
                  onChange={() => setMode(o.id)}
                  className="mt-1 accent-ink"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-sm text-muted">{o.sub}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-control bg-hall/70 px-3 py-2 text-sm text-muted">
            {state.phase === 'grace' ? 'Đang trong ân hạn — không tính phụ phí nếu nhận trả ngay.' : 'Chưa trễ hạn — không có phụ phí.'}
          </p>
        )}
        {hasLateFee && mode === 'custom' && (
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <TextField name="late_fee" label="Thu (đ)" inputMode="numeric" defaultValue={0} required />
            <TextField name="late_fee_reason" label="Lý do giảm" placeholder="Khách quen, sân báo trễ…" maxLength={200} required />
          </div>
        )}
      </fieldset>

      <TextField name="damage_fee" label="Phí hư hỏng / mất (đ)" inputMode="numeric" optional />
      <TextField name="note" label="Ghi chú" optional maxLength={300} />
      <SubmitButton variant="court" pendingLabel="Đang ghi…">
        Nhận trả
      </SubmitButton>
    </ActionForm>
  );
}
