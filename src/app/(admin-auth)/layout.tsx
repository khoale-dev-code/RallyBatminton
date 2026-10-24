import { ShieldCheck } from 'lucide-react';
import { type Metadata, type Viewport } from 'next';
import { type ReactNode } from 'react';

import { Wordmark } from '@/components/brand/logo';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // Cài được Rally Manager ngay từ trang đăng nhập quản trị.
  manifest: '/manager.webmanifest',
  applicationName: 'Rally Manager',
  appleWebApp: { capable: true, title: 'Rally Manager', statusBarStyle: 'default' },
  icons: { apple: '/icons/manager-apple-180.png' },
};

export const viewport: Viewport = { themeColor: '#004b93' };

/** Khung trang đăng nhập NỘI BỘ (chủ sân, nhân viên) — tách hẳn khỏi đăng nhập của khách. */
export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-admin relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-hall-dark px-4 py-10 text-ink">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_26rem_at_50%_-10%,rgb(0_102_204/0.45),transparent_65%),radial-gradient(30rem_18rem_at_100%_110%,rgb(237_28_36/0.18),transparent_70%)]"
      />
      <main id="main" className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-paper">
          <span className="rounded-panel bg-paper px-4 py-2">
            <Wordmark className="h-9" priority />
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-paper/70 uppercase">
            <ShieldCheck className="size-4 text-[#7fb2e5]" aria-hidden />
            Khu vực quản trị
          </span>
        </div>
        <div className="rounded-[1.25rem] bg-paper p-6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:p-7">{children}</div>
        <p className="mt-6 text-center text-xs text-paper/50">Chỉ dành cho chủ sân và nhân viên Rally.</p>
      </main>
    </div>
  );
}
