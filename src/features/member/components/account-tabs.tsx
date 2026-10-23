'use client';

import { CalendarDays, LayoutDashboard, ShieldCheck, UserRoundCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const TABS = [
  { href: '/account', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/account/bookings', label: 'Đơn đặt sân', icon: CalendarDays },
  { href: '/account/profile', label: 'Hồ sơ & bảo mật', icon: UserRoundCog },
  { href: '/account/privacy', label: 'Quyền riêng tư', icon: ShieldCheck },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Tài khoản" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => {
        const active = t.href === '/account' ? pathname === '/account' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'bg-ink text-paper' : 'text-muted hover:bg-hall hover:text-ink',
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
