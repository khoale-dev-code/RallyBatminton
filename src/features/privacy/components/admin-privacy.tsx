'use client';

import { Download, Eye, LoaderCircle, PencilLine, UserX } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';

import { ActionForm, CheckboxField, FieldError, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import {
  anonymizeCustomerAction,
  exportCustomerDataAction,
  publishLegalDocumentAction,
  runRetentionAction,
  updateDataRequestAction,
  updateRetentionAction,
} from '../actions';
import { type LegalCode } from '../consent-text';
import { BLOCK_PLACEHOLDERS, INLINE_PLACEHOLDERS, parseLegalMarkup, unknownPlaceholders } from '../lib/markup';
import { type BranchCancellation, type RetentionPolicy } from '../types';
import { downloadJson } from './download-json';
import { LegalDocumentBody } from './legal-document';

// ---- Yêu cầu của khách ---------------------------------------------------------------------

export function DataRequestActions({ id, verified, canExtend }: { id: string; verified: boolean; canExtend: boolean }) {
  const [status, setStatus] = useState('in_progress');
  return (
    <ActionForm action={updateDataRequestAction.bind(null, id)} className="gap-3">
      <SelectField
        name="status"
        label="Cập nhật trạng thái"
        value={status}
        onChange={(e) => setStatus(e.currentTarget.value)}
        options={[
          { value: 'in_progress', label: 'Đang xử lý (đã phản hồi khách)' },
          ...(canExtend ? [{ value: 'extended', label: 'Gia hạn một lần (có lý do)' }] : []),
          { value: 'completed', label: 'Hoàn tất' },
          { value: 'rejected', label: 'Từ chối (ghi lý do)' },
          { value: 'cancelled', label: 'Khách rút yêu cầu' },
        ]}
      />
      {!verified && (
        <CheckboxField
          name="verified"
          label="Đã xác minh người gửi là chủ dữ liệu"
          hint="Ví dụ: gọi lại đúng số điện thoại, khách đọc đúng mã một đơn đã đặt."
        />
      )}
      {status === 'extended' && <TextField name="extensionReason" label="Lý do gia hạn (báo cho khách)" required maxLength={300} />}
      <TextareaField
        name="note"
        label={status === 'completed' || status === 'rejected' ? 'Kết quả xử lý (gửi cho khách)' : 'Ghi chú'}
        optional={!(status === 'completed' || status === 'rejected')}
        rows={3}
        maxLength={2000}
        placeholder={status === 'rejected' ? 'Ví dụ: Không xác minh được người gửi là chủ số điện thoại.' : undefined}
      />
      <SubmitButton size="sm" pendingLabel="Đang lưu…" className="self-start">
        Lưu
      </SubmitButton>
    </ActionForm>
  );
}

export function ExportCustomerData({ customerId, requestId }: { customerId: string; requestId: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        className={buttonClass('outline', 'sm', 'self-start')}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await exportCustomerDataAction(customerId, requestId);
            if (res.ok) downloadJson(res.json, res.fileName);
            else setError(res.error);
          })
        }
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        Tải dữ liệu của khách (.json)
      </button>
      {error && <p className="text-sm text-shuttle-deep">{error}</p>}
    </div>
  );
}

/** Ẩn danh hóa khách — thao tác không hoàn tác được, phải gõ XOA. */
export function AnonymizePanel({ customerId, requestId }: { customerId: string; requestId: string | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass('danger', 'sm', 'self-start')}>
        <UserX className="size-4" aria-hidden />
        Xóa (ẩn danh hóa) dữ liệu khách
      </button>
    );
  }
  return (
    <ActionForm
      action={anonymizeCustomerAction.bind(null, customerId, requestId)}
      className="gap-3 rounded-control border border-shuttle/30 bg-shuttle-soft/60 p-4"
    >
      <p className="text-sm text-shuttle-deep">
        Xóa tên, số điện thoại, email, ghi chú trên hồ sơ khách, mọi đơn và nhật ký liên quan; tài khoản thành viên (nếu có) bị khóa và xóa
        đăng nhập. Đơn, thanh toán vẫn giữ ở dạng không định danh. <strong>Không hoàn tác được.</strong>
      </p>
      {!requestId && <TextField name="reason" label="Lý do" required maxLength={200} placeholder="Ví dụ: Khách gọi điện yêu cầu xóa" />}
      <TextField name="confirm" label="Gõ XOA để xác nhận" required autoComplete="off" autoCapitalize="characters" />
      <div className="flex gap-2">
        <SubmitButton variant="alert" size="sm" pendingLabel="Đang xóa…">
          Xóa dữ liệu
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>
          Thôi
        </button>
      </div>
    </ActionForm>
  );
}

// ---- Thời hạn lưu trữ ------------------------------------------------------------------------

export function RetentionRow({ policy }: { policy: RetentionPolicy }) {
  return (
    <ActionForm action={updateRetentionAction.bind(null, policy.code)} className="gap-2 sm:flex-row sm:items-end">
      <TextField
        name="days"
        label="Số ngày"
        type="number"
        inputMode="numeric"
        min={1}
        max={7300}
        defaultValue={policy.retentionDays}
        wrapperClassName="sm:w-28"
      />
      {policy.action !== 'keep' && (
        <CheckboxField name="automatic" label="Tự động" defaultChecked={policy.isAutomatic} className="sm:pb-2.5" />
      )}
      <SubmitButton variant="outline" size="sm" pendingLabel="…" className="sm:mb-1">
        Lưu
      </SubmitButton>
    </ActionForm>
  );
}

export function RunRetention({ due }: { due: number }) {
  return (
    <ActionForm
      action={runRetentionAction}
      confirmMessage={`Xử lý ngay ${due} bản ghi đã hết hạn lưu trữ (chỉ các loại bật "Tự động")?`}
      className="gap-0"
    >
      <SubmitButton variant="primary" size="sm" pendingLabel="Đang xử lý…" disabled={due === 0}>
        Dọn dữ liệu hết hạn ngay
      </SubmitButton>
    </ActionForm>
  );
}

// ---- Soạn văn bản pháp lý --------------------------------------------------------------------

export function LegalEditor({
  code,
  initial,
  values,
  cancellation,
  retention,
}: {
  code: LegalCode;
  initial: { title: string; summary: string; body: string };
  values: Record<string, string | null>;
  cancellation: BranchCancellation[];
  retention: RetentionPolicy[];
}) {
  const [body, setBody] = useState(initial.body);
  const [title, setTitle] = useState(initial.title);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const blocks = useMemo(() => parseLegalMarkup(body), [body]);
  const unknown = useMemo(() => unknownPlaceholders(body), [body]);
  const changed = body !== initial.body || title !== initial.title;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <ActionForm action={publishLegalDocumentAction.bind(null, code)} className="min-w-0 gap-4">
        <TextField name="title" label="Tiêu đề" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required maxLength={120} />
        <TextField name="summary" label="Tóm tắt (hiện dưới tiêu đề)" defaultValue={initial.summary} optional maxLength={400} />
        <div role="tablist" aria-label="Chế độ" className="flex w-fit gap-1 rounded-control bg-hall p-1">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-[0.4rem] px-3 text-sm font-medium',
                mode === m ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {m === 'edit' ? <PencilLine className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {m === 'edit' ? 'Soạn' : 'Xem trước'}
            </button>
          ))}
        </div>
        <div className={cn(mode === 'preview' && 'hidden')}>
          <label htmlFor="legal-body" className="mb-1.5 block text-sm font-medium">
            Nội dung
          </label>
          <textarea
            id="legal-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            rows={28}
            spellCheck={false}
            className="w-full rounded-control border border-line bg-paper p-3 font-mono text-[0.85rem] leading-relaxed focus:border-ink focus:outline-none"
          />
          <FieldError name="body" />
          {unknown.length > 0 && (
            <p className="mt-1 text-sm text-shuttle-deep">Khóa không hỗ trợ: {unknown.map((k) => `{{${k}}}`).join(', ')}</p>
          )}
        </div>
        {mode === 'preview' && (
          <div className="rounded-panel border border-line p-4 sm:p-6">
            <p className="mb-4 font-display text-3xl">{title}</p>
            <LegalDocumentBody blocks={blocks} values={values} cancellation={cancellation} retention={retention} />
          </div>
        )}
        <div className="grid gap-4 rounded-panel border border-line bg-hall/50 p-4 sm:grid-cols-2">
          <TextField
            name="changeNote"
            label="Nội dung thay đổi"
            required
            maxLength={300}
            placeholder="Ví dụ: Cập nhật thời hạn hoàn tiền"
            hint="Hiện trong danh sách phiên bản trên website."
          />
          <TextField
            name="effectiveDate"
            label="Ngày có hiệu lực"
            type="date"
            optional
            hint="Để trống = áp dụng ngay. Đổi quan trọng nên báo trước vài ngày."
          />
        </div>
        <p className="text-sm text-muted">
          Đăng sẽ tạo <strong className="text-ink">phiên bản mới</strong>; phiên bản cũ được giữ nguyên làm bằng chứng cho những khách đã
          xác nhận trước đó.
        </p>
        <SubmitButton pendingLabel="Đang đăng…" className="self-start" disabled={!changed || unknown.length > 0}>
          Đăng phiên bản mới
        </SubmitButton>
      </ActionForm>

      <aside className="flex flex-col gap-4 text-sm xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-panel border border-line p-4">
          <p className="mb-2 font-medium">Cú pháp</p>
          <ul className="flex flex-col gap-1.5 font-mono text-[0.8rem] text-muted">
            <li>## Tiêu đề mục</li>
            <li>### Tiêu đề phụ</li>
            <li>- Gạch đầu dòng</li>
            <li>1. Đánh số</li>
            <li>**chữ đậm**</li>
            <li>[chữ](/legal/bao-mat)</li>
            <li>| Cột | Cột |</li>
            <li>&gt; Ghi chú nổi bật</li>
          </ul>
        </div>
        <div className="rounded-panel border border-line p-4">
          <p className="mb-2 font-medium">Chèn giá trị</p>
          <ul className="flex flex-col gap-1.5">
            {INLINE_PLACEHOLDERS.map((p) => (
              <li key={p.key}>
                <code className="rounded bg-hall px-1 text-[0.78rem]">{`{{${p.key}}}`}</code> <span className="text-muted">{p.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-2 font-medium">Khối tự sinh (một dòng riêng)</p>
          <ul className="flex flex-col gap-1.5">
            {BLOCK_PLACEHOLDERS.map((p) => (
              <li key={p.key}>
                <code className="rounded bg-hall px-1 text-[0.78rem]">{`{{${p.key}}}`}</code> <span className="text-muted">{p.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
