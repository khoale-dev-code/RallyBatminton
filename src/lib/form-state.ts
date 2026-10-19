import { type ZodError } from 'zod';

import { toUserMessage } from './errors';

export type FieldErrors = Partial<Record<string, string>>;

/** Trạng thái trả về từ Server Action cho useActionState. */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: FieldErrors;
  /** Tăng sau mỗi lần thành công để form có thể tự reset. */
  nonce?: number;
}

export const initialFormState: FormState = { status: 'idle' };

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function formSuccess(message: string): FormState {
  return { status: 'success', message, nonce: Date.now() };
}

export function formError(message: string, fieldErrors?: FieldErrors): FormState {
  return { status: 'error', message, fieldErrors };
}

/** Lỗi từ database/RPC → trạng thái lỗi tiếng Việt. */
export function formDbError(error: unknown, fallback?: string): FormState {
  return formError(toUserMessage(error, fallback));
}

export function formZodError(error: ZodError, message = 'Vui lòng kiểm tra lại các ô được đánh dấu.'): FormState {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return formError(message, fieldErrors);
}
