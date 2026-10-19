import { type ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Bỏ qua điều hướng
      </a>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
