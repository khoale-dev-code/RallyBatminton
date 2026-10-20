'use client';

import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/cn';

import { toast, useToastEnabled } from './toast';
import { initialFormState, type FormAction, type FormState } from '@/lib/form-state';

import { buttonClass, type ButtonSize, type ButtonVariant } from './button';

const FormStateContext = createContext<FormState>(initialFormState);
const FormPendingContext = createContext(false);

export function useFormFieldError(name: string): string | undefined {
  return useContext(FormStateContext).fieldErrors?.[name];
}

interface ActionFormProps {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Hỏi xác nhận trước khi gửi (thao tác khó hoàn tác). */
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  /** Ẩn thông báo thành công/lỗi chung (khi form tự hiển thị). */
  hideFeedback?: boolean;
  onSuccess?: (state: FormState) => void;
}

/** Form chạy Server Action, cung cấp trạng thái lỗi cho các field con. */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess = false,
  hideFeedback = false,
  onSuccess,
}: ActionFormProps) {
  const toasts = useToastEnabled();
  // Báo thông báo nổi ngay khi Server Action trả kết quả — kể cả khi form biến mất sau đó
  // (vd. nút Xóa trong dòng vừa bị xóa, form đề nghị được thay bằng kết quả).
  const [state, formAction, isPending] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await action(prev, formData);
    if (toasts && !hideFeedback && next.message) {
      if (next.status === 'success') toast.success(next.message);
      else if (next.status === 'error') toast.error(next.message);
    }
    return next;
  }, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi có kết quả mới
  }, [state.nonce]);

  /**
   * Gửi thủ công thay vì để React tự xử lý thuộc tính action: React 19 tự xóa trắng form sau mỗi
   * lần gửi, kể cả khi lỗi — người dùng sẽ mất dữ liệu vừa nhập. Thuộc tính action vẫn giữ để form
   * hoạt động khi JavaScript chưa tải xong.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <FormStateContext.Provider value={state}>
      <FormPendingContext.Provider value={isPending}>
        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)} noValidate>
          {children}
          {!hideFeedback && !(toasts && state.status === 'success') && <FormFeedback state={state} />}
        </form>
      </FormPendingContext.Provider>
    </FormStateContext.Provider>
  );
}

export function FormFeedback({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;
  const isError = state.status === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={cn(
        'animate-fade rounded-control px-3 py-2 text-sm',
        isError ? 'bg-shuttle-soft text-shuttle-deep' : 'bg-court-soft text-court-deep',
      )}
    >
      {state.message}
    </p>
  );
}

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size = 'md',
  className,
  name,
  value,
  disabled = false,
}: SubmitButtonProps) {
  const status = useFormStatus();
  const actionPending = useContext(FormPendingContext);
  const pending = status.pending || actionPending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}

export const controlClass =
  'w-full rounded-control border border-line bg-paper px-3 text-[0.95rem] text-ink placeholder:text-muted/70 ' +
  'transition-colors hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 ' +
  'aria-[invalid=true]:border-shuttle-deep disabled:bg-hall disabled:text-muted';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, hint, error, optional, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (không bắt buộc)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-shuttle-deep">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<ComponentProps<'input'>, 'name' | 'id'>;

interface TextFieldProps extends InputProps {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  wrapperClassName?: string;
}

export function TextField({ name, label, hint, optional, wrapperClassName, className, ...props }: TextFieldProps) {
  const id = useId();
  const error = useFormFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass, 'min-h-11', className)}
        {...props}
      />
    </FieldShell>
  );
}

interface PasswordFieldProps extends Omit<InputProps, 'type'> {
  name: string;
  label: string;
  hint?: string;
  wrapperClassName?: string;
}

/** Ô mật khẩu có nút con mắt để hiện / ẩn nội dung đang gõ. */
export function PasswordField({ name, label, hint, wrapperClassName, className, ...props }: PasswordFieldProps) {
  const id = useId();
  const error = useFormFieldError(name);
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClass, 'min-h-11 pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-control text-muted transition-colors hover:text-ink focus-visible:text-ink"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </FieldShell>
  );
}

interface TextareaFieldProps extends Omit<ComponentProps<'textarea'>, 'name' | 'id'> {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
}

export function TextareaField({ name, label, hint, optional, className, rows = 3, ...props }: TextareaFieldProps) {
  const id = useId();
  const error = useFormFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn(controlClass, 'py-2.5 leading-relaxed', className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'name' | 'id' | 'children'> {
  name: string;
  label: string;
  options: SelectOption[];
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
}

export function SelectField({
  name,
  label,
  options,
  hint,
  optional,
  placeholder,
  wrapperClassName,
  className,
  ...props
}: SelectFieldProps) {
  const id = useId();
  const error = useFormFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <select id={id} name={name} aria-invalid={Boolean(error)} className={cn(controlClass, 'min-h-11 pr-8', className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'name' | 'type' | 'id'> {
  name: string;
  label: string;
  hint?: string;
}

export function CheckboxField({ name, label, hint, className, ...props }: CheckboxFieldProps) {
  const id = useId();
  const error = useFormFieldError(name);
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} name={name} type="checkbox" className="mt-1 size-5 shrink-0 accent-court-deep" {...props} />
      <label htmlFor={id} className="flex flex-col text-[0.95rem]">
        <span className="font-medium">{label}</span>
        {(error ?? hint) && <span className={cn('text-sm', error ? 'text-shuttle-deep' : 'text-muted')}>{error ?? hint}</span>}
      </label>
    </div>
  );
}

/** Lỗi chung của một nhóm (vd. checkbox ngày trong tuần). */
export function FieldError({ name }: { name: string }) {
  const error = useFormFieldError(name);
  return error ? <p className="text-sm text-shuttle-deep">{error}</p> : null;
}
