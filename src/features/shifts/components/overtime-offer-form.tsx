'use client';

import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { formatMinutes, formatVnd } from '@/lib/format';
import { type FormAction } from '@/lib/form-state';

import { OVERTIME_MINUTES, OVERTIME_MULTIPLIERS, overtimePay, suggestedOvertimeRate } from '../lib/overtime';

interface OvertimeOfferFormProps {
  action: FormAction;
  baseHourly: number | null;
  /** Giờ ra ca theo lịch, dạng "HH:MM" — để hiện khung giờ tăng ca. */
  scheduledEndLabel: string;
  scheduledEndMs: number;
  tz: string;
  /** Ca đã qua giờ ra: chỉ còn cách ghi nhận đã đồng ý trực tiếp. */
  windowPassed: boolean;
}

function parseMoney(value: string): number {
  const n = Number(value.replace(/[.\s,₫đ]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function clockAfter(endMs: number, minutes: number, tz: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(
    new Date(endMs + minutes * 60000),
  );
}

/** Đề nghị tăng ca: chọn thời gian, giá (gợi ý theo hệ số luật lao động), xem trước tiền tăng ca. */
export function OvertimeOfferForm({ action, baseHourly, scheduledEndLabel, scheduledEndMs, tz, windowPassed }: OvertimeOfferFormProps) {
  const [minutes, setMinutes] = useState('120');
  const [rate, setRate] = useState(() => String(suggestedOvertimeRate(baseHourly) ?? ''));
  const rateValue = parseMoney(rate);
  const mins = Number(minutes);
  const belowMinimum = baseHourly !== null && rateValue > 0 && rateValue < baseHourly * 1.5;

  return (
    <ActionForm action={action} resetOnSuccess>
      <SelectField
        name="minutes"
        label="Ở lại thêm"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        options={OVERTIME_MINUTES.map((m) => ({
          value: String(m),
          label: `${formatMinutes(m)} (${scheduledEndLabel}–${clockAfter(scheduledEndMs, m, tz)})`,
        }))}
      />
      <div className="flex flex-col gap-2">
        <TextField
          name="hourly_rate"
          label="Giá tăng ca (đ/giờ)"
          inputMode="numeric"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
          hint={baseHourly !== null ? `Lương thường: ${formatVnd(baseHourly)}/giờ.` : 'Nhân viên chưa có mức lương — nhập giá tăng ca.'}
        />
        {baseHourly !== null && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Giá gợi ý">
            {OVERTIME_MULTIPLIERS.map((m) => {
              const value = suggestedOvertimeRate(baseHourly, m.value) ?? 0;
              const active = rateValue === value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setRate(String(value))}
                  aria-pressed={active}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs font-medium',
                    active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
                  )}
                >
                  {m.label} · {formatVnd(value)}
                </button>
              );
            })}
          </div>
        )}
        {belowMinimum && (
          <p className="flex items-start gap-1.5 text-sm text-amber-deep">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Thấp hơn 150% lương thường — mức tối thiểu ngày thường theo Bộ luật Lao động 2019 (Điều 98).
          </p>
        )}
      </div>
      {rateValue > 0 && mins > 0 && (
        <p className="rounded-control bg-hall px-3 py-2 text-sm">
          Tiền tăng ca nếu làm đủ: {formatMinutes(mins)} × {formatVnd(rateValue)}/giờ ={' '}
          <strong className="tabular">{formatVnd(overtimePay(mins, rateValue))}</strong>
        </p>
      )}
      <TextField name="reason" label="Lý do" placeholder="Khách đông, cần hỗ trợ quầy" required minLength={3} maxLength={300} />
      <CheckboxField
        name="agreed_in_person"
        label="Nhân viên đã đồng ý trực tiếp"
        hint={
          windowPassed
            ? 'Ca đã qua giờ tăng ca nên chỉ ghi nhận được thỏa thuận trực tiếp.'
            : 'Bỏ chọn để gửi đề nghị — nhân viên bấm Đồng ý / Từ chối trong “Ca & lương của tôi”.'
        }
        defaultChecked={windowPassed}
      />
      <SubmitButton pendingLabel="Đang gửi…">Đề nghị tăng ca</SubmitButton>
    </ActionForm>
  );
}
