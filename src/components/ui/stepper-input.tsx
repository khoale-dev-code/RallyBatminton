'use client';

import { Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/cn';

interface StepperInputProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label: string;
  className?: string;
}

/** Ô số có nút − / + (44px, dễ bấm trên điện thoại). */
export function StepperInput({ value, onChange, min = 0, max = 100000, disabled, label, className }: StepperInputProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.floor(n) : min));
  return (
    <div
      className={cn(
        'inline-flex h-11 shrink-0 items-stretch overflow-hidden rounded-control border border-line bg-paper',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Giảm ${label}`}
        className="grid w-11 place-items-center hover:bg-hall disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/[^\d]/g, '')) || 0))}
        onFocus={(e) => e.currentTarget.select()}
        disabled={disabled}
        aria-label={label}
        className="w-12 border-x border-line text-center tabular outline-none focus:bg-hall/50 sm:w-14"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Tăng ${label}`}
        className="grid w-11 place-items-center hover:bg-hall disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
