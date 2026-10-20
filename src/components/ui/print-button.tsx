'use client';

import { Printer } from 'lucide-react';
import { useEffect } from 'react';

import { Button, type ButtonVariant } from '@/components/ui/button';

/** Nút in trang hiện tại; `auto` = mở hộp thoại in ngay khi trang tải (mở từ nút "In hóa đơn"). */
export function PrintButton({
  label = 'In',
  auto = false,
  variant = 'primary',
}: {
  label?: string;
  auto?: boolean;
  variant?: ButtonVariant;
}) {
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, [auto]);
  return (
    <Button onClick={() => window.print()} variant={variant} className="print-hide">
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
