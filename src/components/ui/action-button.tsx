'use client';

import { type ButtonSize, type ButtonVariant } from './button';
import { ActionForm, SubmitButton } from './form';

import { type FormAction } from '@/lib/form-state';

interface ActionButtonProps {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirmMessage?: string;
  hidden?: Record<string, string>;
}

/** Nút thao tác đơn (đổi trạng thái, xóa ảnh…) chạy Server Action, hiển thị kết quả ngay dưới nút. */
export function ActionButton({ action, label, pendingLabel, variant = 'outline', size = 'sm', confirmMessage, hidden }: ActionButtonProps) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="gap-2">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
