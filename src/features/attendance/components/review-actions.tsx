'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';

import { decideActualTimeAction, decideFixAction } from '../actions';

/** Duyệt (một chạm) / Từ chối (bắt buộc ghi lý do) một yêu cầu sửa giờ. */
export function FixDecision({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false);
  if (rejecting) {
    return (
      <ActionForm action={decideFixAction.bind(null, requestId, false)} className="gap-2">
        <TextField name="note" label="Lý do từ chối" placeholder="Ví dụ: Camera thấy đến 6:14" required autoFocus />
        <div className="flex gap-2">
          <SubmitButton variant="danger" size="sm" pendingLabel="Đang gửi…">
            Từ chối
          </SubmitButton>
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
            Thôi
          </Button>
        </div>
      </ActionForm>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={decideFixAction.bind(null, requestId, true)} className="gap-0">
        <SubmitButton size="sm" pendingLabel="Đang duyệt…">
          <Check className="size-4" aria-hidden />
          Duyệt
        </SubmitButton>
      </ActionForm>
      <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
        <X className="size-4" aria-hidden />
        Từ chối
      </Button>
    </div>
  );
}

/** Ra ca trễ hơn khung: trả theo giờ thực tế (ở lại làm thật) hoặc giữ công theo khung ca. */
export function ActualTimeDecision({ shiftId }: { shiftId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={decideActualTimeAction.bind(null, shiftId, 'approved')} className="gap-0">
        <SubmitButton size="sm" pendingLabel="Đang lưu…">
          Trả theo giờ thực tế
        </SubmitButton>
      </ActionForm>
      <ActionForm action={decideActualTimeAction.bind(null, shiftId, 'kept')} className="gap-0">
        <SubmitButton variant="outline" size="sm" pendingLabel="Đang lưu…">
          Giữ theo khung ca
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
