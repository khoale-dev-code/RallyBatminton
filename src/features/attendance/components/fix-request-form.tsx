'use client';

import { LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';

import { ActionForm, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { cn } from '@/lib/cn';

import { requestFixAction } from '../actions';

/**
 * Nhân viên khai giờ vào / ra thật khi quên quét QR. Gửi xong chờ chủ sân duyệt — giờ quét thật vẫn được lưu
 * để đối chiếu, nên khai sai là chủ sân thấy ngay.
 */
export function FixRequestForm({
  shiftId,
  kinds,
  defaults,
}: {
  shiftId: string;
  /** Loại được phép khai (vd. đã có giờ vào thì chỉ khai giờ ra). */
  kinds: Array<'in' | 'out'>;
  defaults: { in?: string; out?: string };
}) {
  const [kind, setKind] = useState<'in' | 'out'>(kinds[0] ?? 'in');
  return (
    <ActionForm action={requestFixAction.bind(null, shiftId)} resetOnSuccess>
      {kinds.length > 1 ? (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-sm font-medium">Quên quét lúc</legend>
          {kinds.map((k) => (
            <label
              key={k}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border text-sm font-medium transition-colors',
                kind === k ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-primary/40',
              )}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === 'in' ? <LogIn className="size-4" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
              {k === 'in' ? 'Vào ca' : 'Ra ca'}
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      <TextField
        key={kind}
        name="time"
        type="time"
        label={kind === 'in' ? 'Giờ đến sân thật' : 'Giờ về thật'}
        defaultValue={defaults[kind] ?? ''}
        required
        hint={kind === 'in' ? 'Giờ bạn có mặt tại sân.' : 'Giờ bạn rời sân sau khi làm xong.'}
      />
      <TextareaField
        name="reason"
        label="Lý do"
        rows={2}
        maxLength={300}
        placeholder={kind === 'in' ? 'Ví dụ: Đến 5:55, mở cửa sân luôn nên quên quét' : 'Ví dụ: Ở lại dọn sân tới 22:20, quên quét ra'}
        required
      />
      <SubmitButton pendingLabel="Đang gửi…" className="w-full sm:w-auto">
        Gửi yêu cầu sửa giờ
      </SubmitButton>
    </ActionForm>
  );
}
