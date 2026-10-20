'use client';

import { type ComponentProps, type ReactNode } from 'react';

import { controlClass } from '@/components/ui/form';
import { cn } from '@/lib/cn';

import { formatMoneyInput } from '../../lib/product-draft';

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  required?: boolean;
  counter?: { value: number; max: number };
  className?: string;
  children: ReactNode;
}

/** Nhãn + ô nhập + gợi ý/lỗi cho màn sản phẩm (ô nhập do trang tự quản lý trạng thái). */
export function Field({ id, label, hint, error, optional, required, counter, className, children }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-shuttle-deep"> *</span>}
          {optional && <span className="font-normal text-muted"> (không bắt buộc)</span>}
        </label>
        {counter && (
          <span className={cn('text-xs tabular', counter.value > counter.max ? 'text-shuttle-deep' : 'text-muted')}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
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

type InputProps = Omit<ComponentProps<'input'>, 'onChange' | 'value'> & {
  id: string;
  value: string;
  onValue: (v: string) => void;
  error?: string;
};

export function TextInput({ id, value, onValue, error, className, ...rest }: InputProps) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(controlClass, 'min-h-11', className)}
      {...rest}
    />
  );
}

/** Ô tiền: gõ số tự do, rời ô thì định dạng 250.000; hiện đơn vị ₫. */
export function MoneyInput({ id, value, onValue, error, className, ...rest }: InputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => onValue(e.target.value.replace(/[^\d.,\s]/g, ''))}
        onBlur={() => onValue(formatMoneyInput(value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(controlClass, 'min-h-11 pr-8 tabular', className)}
        {...rest}
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
        ₫
      </span>
    </div>
  );
}

type AreaProps = Omit<ComponentProps<'textarea'>, 'onChange' | 'value'> & {
  id: string;
  value: string;
  onValue: (v: string) => void;
  error?: string;
};

export function TextArea({ id, value, onValue, error, className, rows = 4, ...rest }: AreaProps) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      onChange={(e) => onValue(e.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(controlClass, 'py-2.5 leading-relaxed', className)}
      {...rest}
    />
  );
}

export function Check({
  id,
  checked,
  onChecked,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className={cn('flex min-h-11 cursor-pointer items-start gap-3 py-1', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChecked(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-court-deep"
      />
      <span className="flex flex-col">
        <span className="leading-snug">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}
