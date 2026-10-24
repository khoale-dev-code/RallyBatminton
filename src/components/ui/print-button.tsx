'use client';

import { Printer } from 'lucide-react';
import { useEffect } from 'react';

import { Button, type ButtonVariant } from '@/components/ui/button';
import { printPage } from '@/features/desktop/print';

/**
 * Nút in trang hiện tại; `auto` = in ngay khi trang tải (mở từ nút "In hóa đơn").
 * Trong Rally Manager cho Windows đã chọn máy in: in thẳng ra máy in hóa đơn, không hộp thoại.
 */
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
    const id = window.setTimeout(() => void printPage(), 400);
    return () => window.clearTimeout(id);
  }, [auto]);
  return (
    <Button onClick={() => void printPage()} variant={variant} className="print-hide">
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
