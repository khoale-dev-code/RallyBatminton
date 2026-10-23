'use client';

import { CalendarClock, CircleCheck, Copy, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { ActionForm, CheckboxField, FieldError, SubmitButton, TextareaField, TextField, useFormFieldError } from '@/components/ui/form';
import { Turnstile } from '@/features/booking/components/turnstile';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPhone } from '@/lib/format';

import { submitDataRequestAction } from '../actions';
import { DATA_REQUEST_KINDS, kindLabel, type DataRequestKind } from '../lib/policy';

const resultSchema = z.object({
  code: z.string(),
  kind: z.string(),
  verified: z.boolean(),
  ackDueAt: z.string(),
  dueAt: z.string(),
});
type Result = z.infer<typeof resultSchema>;

function KindPicker({ value, onChange }: { value: DataRequestKind; onChange: (k: DataRequestKind) => void }) {
  const error = useFormFieldError('kind');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Bạn muốn Rally làm gì?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {DATA_REQUEST_KINDS.map((k) => (
          <label
            key={k.kind}
            className={cn(
              'flex cursor-pointer flex-col gap-0.5 rounded-control border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
              value === k.kind ? 'border-court-strong bg-court-soft' : 'border-line bg-paper hover:border-ink/30',
            )}
          >
            <input
              type="radio"
              name="kind"
              value={k.kind}
              checked={value === k.kind}
              onChange={() => onChange(k.kind)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2 font-medium">
              {k.label}
              <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
                ≤ {k.days} ngày
              </span>
            </span>
            <span className="text-sm text-muted">{k.hint}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-shuttle-deep">{error}</p>}
    </fieldset>
  );
}

function TurnstileInput({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState('');
  if (!siteKey) return <input type="hidden" name="turnstileToken" value="dev-no-turnstile" />;
  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name="turnstileToken" value={token} />
      <Turnstile siteKey={siteKey} onToken={(t) => setToken(t ?? '')} resetSignal={0} action="data_request" />
      <FieldError name="turnstileToken" />
    </div>
  );
}

function Submitted({ result, onReset }: { result: Result; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="animate-fade flex flex-col gap-5 rounded-[1.5rem] border border-court/40 bg-court-soft p-5 sm:p-7" role="status">
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-1 size-7 shrink-0 text-court-deep" aria-hidden />
        <div>
          <p className="font-display text-3xl leading-tight">Rally đã nhận yêu cầu</p>
          <p className="mt-1 text-ink/75">{kindLabel(result.kind)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper px-4 py-3">
        <span className="text-sm text-muted">Mã yêu cầu</span>
        <span className="font-display text-2xl tracking-wider tabular">{result.code}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium hover:bg-hall"
        >
          <Copy className="size-4" aria-hidden />
          {copied ? 'Đã chép' : 'Chép mã'}
        </button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl bg-paper p-4">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-court-deep" aria-hidden />
          <div>
            <dt className="text-sm text-muted">Rally phản hồi trước</dt>
            <dd className="font-medium">{formatDateTime(result.ackDueAt)}</dd>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl bg-paper p-4">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-court-deep" aria-hidden />
          <div>
            <dt className="text-sm text-muted">Hoàn thành trước</dt>
            <dd className="font-medium">{formatDateTime(result.dueAt)}</dd>
          </div>
        </div>
      </dl>
      <p className="flex gap-2 text-[0.95rem] text-ink/80">
        {result.verified ? (
          <>
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-court-deep" aria-hidden />
            Đã xác minh bạn là chủ dữ liệu. Rally sẽ thực hiện và báo kết quả qua thông tin liên hệ bạn để lại.
          </>
        ) : (
          <>
            <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-amber-deep" aria-hidden />
            Rally sẽ liên hệ để xác minh bạn là chủ dữ liệu trước khi cung cấp hoặc xóa dữ liệu (bảo vệ bạn khỏi người mạo danh).
          </>
        )}
      </p>
      <button type="button" onClick={onReset} className="w-fit text-sm font-medium underline underline-offset-4">
        Gửi yêu cầu khác
      </button>
    </div>
  );
}

/** Form công khai: khách (kể cả không có tài khoản) gửi yêu cầu xem / tải / sửa / xóa / rút đồng ý… */
export function DataRequestForm({
  turnstileSiteKey,
  member,
}: {
  turnstileSiteKey: string;
  member: { name: string; phone: string | null; email: string | null } | null;
}) {
  const [kind, setKind] = useState<DataRequestKind>('access');
  const [result, setResult] = useState<Result | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (result) {
    return (
      <Submitted
        result={result}
        onReset={() => {
          setResult(null);
          setFormKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <ActionForm
      key={formKey}
      action={submitDataRequestAction}
      hideFeedback={false}
      onSuccess={(state) => {
        const parsed = resultSchema.safeParse('result' in state ? state.result : null);
        if (parsed.success) setResult(parsed.data);
      }}
    >
      <KindPicker value={kind} onChange={setKind} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Họ và tên" autoComplete="name" required maxLength={80} defaultValue={member?.name ?? ''} />
        <TextField
          name="phone"
          label="Số điện thoại"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0912 345 678"
          defaultValue={member?.phone ? formatPhone(member.phone) : ''}
          hint="Số bạn đã dùng khi đặt sân."
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          optional
          defaultValue={member?.email ?? ''}
          hint="Để nhận bản sao dữ liệu qua email (nếu cần)."
        />
        {!member && (
          <TextField
            name="bookingCode"
            label="Mã một đơn đã đặt"
            optional
            placeholder="RB-XXXXXXXX"
            autoCapitalize="characters"
            hint="Khớp với số điện thoại → xác minh ngay, xử lý nhanh hơn."
          />
        )}
      </div>
      <TextareaField
        name="details"
        label="Nội dung yêu cầu"
        rows={4}
        maxLength={2000}
        required
        placeholder={
          kind === 'correct'
            ? 'Ví dụ: Tên đang ghi "Nguyen Van A", đúng là "Nguyễn Văn An".'
            : kind === 'delete'
              ? 'Ví dụ: Tôi không dùng dịch vụ nữa, xin xóa tên và số điện thoại của tôi.'
              : 'Mô tả ngắn yêu cầu của bạn.'
        }
      />
      <CheckboxField name="confirm" label="Tôi là chủ dữ liệu, hoặc được chủ dữ liệu ủy quyền gửi yêu cầu này." />
      {!member && <TurnstileInput siteKey={turnstileSiteKey} />}
      <SubmitButton variant="brand" size="lg" pendingLabel="Đang gửi…" className="w-full sm:w-auto">
        Gửi yêu cầu
      </SubmitButton>
    </ActionForm>
  );
}
