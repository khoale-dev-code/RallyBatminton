// RALLY_PUBLIC_NAV_V7
'use client';

import { ArrowRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AccountMenu, MobileAccountLinks } from '@/features/member/components/account-menu';

const LINKS = [
  { href: '/booking', label: 'Đặt sân' },
  { href: '/products', label: 'Vật phẩm' },
  { href: '/rentals', label: 'Cho thuê' },
  { href: '/booking/lookup', label: 'Tra cứu' },
  { href: '/branches', label: 'Chi nhánh' },
  { href: '/guide', label: 'Cẩm nang' },
  { href: '/about', label: 'Giới thiệu' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/booking') return pathname === '/booking';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const cta = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#006341] px-4 text-[0.9rem] font-semibold whitespace-nowrap text-white shadow-[0_7px_20px_-12px_rgba(0,99,65,0.9)] transition-colors hover:bg-[#004e34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006341]';

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open]);

  return (
    <>
      <nav aria-label="Điều hướng chính" className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex">
        {LINKS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex min-h-11 items-center justify-center rounded-md px-2.5 text-[0.85rem] font-medium whitespace-nowrap transition-colors hover:text-[#006341] ${active ? 'text-[#006341]' : 'text-[#2b2b2b]'}`}
            >
              {item.label}
              {active && <span aria-hidden className="absolute right-2.5 bottom-[5px] left-2.5 h-[2px] rounded-full bg-[#006341]" />}
            </Link>
          );
        })}
      </nav>
      <div className="hidden shrink-0 items-center gap-2 xl:flex">
        <AccountMenu />
        <Link href="/booking" className={cta}>Đặt sân ngay <ArrowRight aria-hidden size={17} /></Link>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 xl:hidden">
        {!open && <Link href="/booking" className={`${cta} min-h-10 px-3 text-[0.8rem] sm:px-4`}>Đặt sân ngay <ArrowRight aria-hidden size={15} className="hidden sm:block" /></Link>}
        <button
          type="button"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          aria-controls="rally-client-mobile-nav"
          onClick={() => setOpen((value) => !value)}
          className="grid size-11 place-items-center rounded-lg border border-[#e5eae6] bg-white text-[#2b2b2b] transition-colors hover:bg-[#f3f7f4]"
        >
          {open ? <X aria-hidden size={23} /> : <Menu aria-hidden size={23} />}
        </button>
      </div>
      {open && (
        <>
          <button type="button" aria-label="Đóng menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-70px)] bg-black/30 xl:hidden" />
          <nav id="rally-client-mobile-nav" aria-label="Menu khách hàng" className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-70px)] overflow-y-auto border-b border-[#e5eae6] bg-white px-4 py-5 shadow-xl sm:px-6 xl:hidden">
            <p className="mb-3 text-[0.72rem] font-bold tracking-[0.16em] text-[#006341]">KHÁM PHÁ RALLY</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {LINKS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center justify-between rounded-lg px-3 text-[0.98rem] font-medium ${active ? 'bg-[#e6f3ed] text-[#006341]' : 'text-[#2b2b2b] hover:bg-[#f5f7f6]'}`}
                    >
                      {item.label}{active && <span className="size-2 rounded-full bg-[#006341]" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-3 border-t border-[#e5eae6] pt-5">
              <MobileAccountLinks onNavigate={() => setOpen(false)} />
              <Link href="/booking" onClick={() => setOpen(false)} className={`${cta} w-full`}>Đặt sân ngay <ArrowRight aria-hidden size={17} /></Link>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
