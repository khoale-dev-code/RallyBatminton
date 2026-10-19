import Link from 'next/link';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'court' | 'brand' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink/85',
  court: 'bg-court text-ink hover:bg-[#57a83e]',
  /** Nút hành động chính phía khách: xanh đậm chữ trắng (tương phản 5:1). */
  brand: 'bg-court-strong text-paper shadow-[0_8px_20px_-10px_rgb(43_127_33/0.7)] hover:bg-court-deep',
  outline: 'border border-ink/20 bg-paper text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-hall',
  danger: 'border border-shuttle-deep/40 bg-paper text-shuttle-deep hover:bg-shuttle-soft',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-[0.95rem]',
  lg: 'min-h-13 px-6 text-base',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap',
    'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ variant = 'outline', size = 'md', className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
