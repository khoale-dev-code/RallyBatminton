'use client';

import { CalendarDays, ChevronDown, LogOut, UserRound, UserRoundCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { memberSignOutAction } from '../actions';
import { refreshMember, useMember } from '../hooks/use-member';
import { initialsOf } from '../lib/initials';
import { tierDef } from '../lib/tiers';

const MENU = [
  { href: '/account', label: 'Tài khoản của tôi', icon: UserRound },
  { href: '/account/bookings', label: 'Đơn đặt sân', icon: CalendarDays },
  { href: '/account/profile', label: 'Hồ sơ & bảo mật', icon: UserRoundCog },
];

/** Nút tài khoản trên thanh điều hướng (máy tính). */
export function AccountMenu() {
  const state = useMember();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Đăng nhập / đăng xuất bằng Server Action không báo cho trình duyệt — đọc lại khi đổi trang.
  useEffect(() => {
    void refreshMember();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (state.status !== 'member') {
    return (
      <Link href="/login" className={cn(buttonClass('ghost', 'md', 'px-3 text-[0.92rem]'), state.status === 'loading' && 'opacity-70')}>
        <UserRound className="size-4" aria-hidden />
        <span className="hidden xl:inline">Đăng nhập</span>
        <span className="sr-only xl:hidden">Đăng nhập</span>
      </Link>
    );
  }

  const { profile } = state;
  const tier = tierDef(profile.tier);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 transition-colors hover:border-ink/40"
      >
        <span className="grid size-8 place-items-center rounded-full bg-ink font-display text-sm text-paper">
          {initialsOf(profile.full_name)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium xl:inline">{profile.full_name}</span>
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade absolute top-full right-0 z-30 mt-2 w-72 overflow-hidden rounded-panel border border-line bg-paper shadow-lift"
        >
          <div className="flex items-center gap-3 border-b border-line bg-hall px-4 py-3">
            <span className="grid size-10 place-items-center rounded-full bg-ink font-display text-paper">
              {initialsOf(profile.full_name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{profile.full_name}</span>
              <span className="text-xs text-muted">
                <span className={cn('mr-1.5 rounded-full px-2 py-0.5 font-medium', tier.badge)}>{tier.label}</span>
                <span className="tabular">{profile.points.toLocaleString('vi-VN')} điểm</span>
              </span>
            </span>
          </div>
          <ul className="py-1">
            {MENU.map((m) => (
              <li key={m.href}>
                <Link
                  role="menuitem"
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 px-4 text-sm hover:bg-hall"
                >
                  <m.icon className="size-4 text-muted" aria-hidden />
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action={memberSignOutAction} className="border-t border-line">
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 px-4 text-sm text-shuttle-deep hover:bg-shuttle-soft"
            >
              <LogOut className="size-4" aria-hidden />
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Khối tài khoản trong menu điện thoại. */
export function MobileAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const state = useMember();
  if (state.status !== 'member') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link href="/login" onClick={onNavigate} className={buttonClass('outline', 'lg', 'w-full')}>
          Đăng nhập
        </Link>
        <Link href="/register" onClick={onNavigate} className={buttonClass('primary', 'lg', 'w-full')}>
          Đăng ký
        </Link>
      </div>
    );
  }
  const tier = tierDef(state.profile.tier);
  return (
    <Link href="/account" onClick={onNavigate} className="flex items-center gap-3 rounded-panel border border-line p-3">
      <span className="grid size-11 place-items-center rounded-full bg-ink font-display text-paper">
        {initialsOf(state.profile.full_name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{state.profile.full_name}</span>
        <span className="text-sm text-muted">
          {tier.label} · <span className="tabular">{state.profile.points.toLocaleString('vi-VN')} điểm</span>
        </span>
      </span>
      <span className="ml-auto text-sm font-medium text-court-deep">Tài khoản</span>
    </Link>
  );
}
