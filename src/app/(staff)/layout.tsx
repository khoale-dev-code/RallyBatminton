import Link from 'next/link';
import { type ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';

/** Khung tối giản cho trang nhân viên dùng trên điện thoại (chấm công). */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-hall">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-paper px-4 py-3 sm:px-6">
        <Logo href="/admin" />
        <Link href="/admin" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          Trang quản lý
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
