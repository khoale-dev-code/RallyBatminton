'use client';

import { ArrowRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { AccountMenu, MobileAccountLinks } from '@/features/member/components/account-menu';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/booking', label: 'Đặt sân' },
  { href: '/products', label: 'Vật phẩm' },
  { href: '/rentals', label: 'Cho thuê' },
  { href: '/booking/lookup', label: 'Tra cứu' },
  { href: '/branches', label: 'Chi nhánh' },
  { href: '/about', label: 'Giới thiệu' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/booking') return pathname === '/booking';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-0.5 lg:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? 'page' : undefined}
            className={cn(
              'rounded-control px-2.5 py-2 text-[0.92rem] whitespace-nowrap transition-colors hover:bg-hall xl:px-3',
              isActive(pathname, l.href) && 'font-medium text-court-strong',
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="hidden items-center gap-2 lg:flex">
        <AccountMenu />
        <Link href="/booking" className={buttonClass('brand', 'md')}>
          Đặt sân ngay
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Điện thoại / máy tính bảng: nút Đặt sân luôn hiện cạnh menu. */}
      <div className="flex items-center gap-1 lg:hidden">
        {!open && (
          <Link href="/booking" className={buttonClass('brand', 'sm', 'min-h-10 px-3.5')}>
            Đặt sân ngay
          </Link>
        )}
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-control hover:bg-hall lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Đóng menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="animate-fade absolute inset-x-0 top-full h-dvh bg-ink/30 lg:hidden"
        />
      )}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Điều hướng"
          className="animate-fade absolute inset-x-0 top-full z-10 border-b border-line bg-paper px-4 pb-5 shadow-lift sm:px-6 lg:hidden"
        >
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(pathname, l.href) ? 'page' : undefined}
                  className="flex min-h-12 items-center border-b border-line text-lg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <MobileAccountLinks onNavigate={() => setOpen(false)} />
            <Link href="/booking" onClick={() => setOpen(false)} className={buttonClass('brand', 'lg', 'w-full')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
