'use client';

import { Download, LoaderCircle, UserX } from 'lucide-react';
import { useState, useTransition } from 'react';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { buttonClass } from '@/components/ui/button';

import {
  anonymizeCustomerAction,
  exportCustomerDataAction,
  runRetentionAction,
  updateDataRequestAction,
  updateRetentionAction,
} from '../actions';
import { type RetentionPolicy } from '../types';
import { downloadJson } from './download-json';

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

// Trình soạn văn bản kiểu Word (giữ định dạng lưu pháp lý hiện tại).
export { LegalEditor } from './legal-word-editor';
