import { Logo } from '@/components/brand/logo';

import { SiteNav } from './site-nav';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <SiteNav />
      </div>
    </header>
  );
}
