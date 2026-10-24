'use client';

import { Archive } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

import { openCashDrawer } from '../print';
import { useDesktopState } from '../store';

/** Nút "Mở ngăn kéo" — chỉ hiện trong Rally Manager cho Windows trên máy đã bật ngăn kéo tiền. Mỗi lần mở được ghi nhật ký. */
export function DrawerButton({ className, label = 'Mở ngăn kéo' }: { className?: string; label?: string }) {
  const desktop = useDesktopState();
  const [busy, setBusy] = useState(false);
  if (desktop.status !== 'desktop' || !desktop.settings?.drawerEnabled) return null;
  const open = async () => {
    setBusy(true);
    try {
      await openCashDrawer('manual');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      title="Mở ngăn kéo tiền (được ghi nhật ký)"
      className={cn(
        'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-medium disabled:opacity-60',
        className,
      )}
    >
      <Archive className="size-5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
