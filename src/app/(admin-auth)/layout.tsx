import { ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import { Wordmark } from '@/components/brand/logo';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Khung trang đăng nhập NỘI BỘ (chủ sân, nhân viên) — tách hẳn khỏi đăng nhập của khách. */
export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-4 py-10 text-ink">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_26rem_at_50%_-10%,rgb(98_187_70/0.28),transparent_65%)]"
      />
      <main id="main" className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-paper">
          <span className="rounded-panel bg-paper px-4 py-2">
            <Wordmark className="h-9" priority />
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-paper/70 uppercase">
            <ShieldCheck className="size-4 text-court" aria-hidden />
            Khu vực quản trị
          </span>
        </div>
        <div className="rounded-[1.25rem] bg-paper p-6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:p-7">{children}</div>
        <p className="mt-6 text-center text-xs text-paper/50">Chỉ dành cho chủ sân và nhân viên Rally.</p>
      </main>
    </div>
  );
}
