// RALLY_PUBLIC_NAV_V7: shared header for every /(site) page
import { Logo } from '@/components/brand/logo';

import { SiteNav } from './site-nav';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e5eae6] bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
      <div className="relative mx-auto flex h-[70px] w-full max-w-7xl items-center justify-between gap-5 px-4 sm:px-6">
        <Logo className="shrink-0" />
        <SiteNav />
      </div>
    </header>
  );
}
