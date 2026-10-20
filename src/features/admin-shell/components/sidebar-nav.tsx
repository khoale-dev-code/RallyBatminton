'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { type NavGroup, type NavGroupKey } from '../nav';

import { NAV_ICONS } from './nav-icons';

export function isNavActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavProps {
  nav: NavGroup[];
  pathname: string;
  /** Thu gọn thành cột biểu tượng (máy tính). */
  rail: boolean;
  closedGroups: NavGroupKey[];
  onToggleGroup: (key: NavGroupKey) => void;
  onNavigate?: () => void;
}

/** Menu quản trị theo nhóm; mỗi nhóm đóng/mở được, nhóm đang đóng vẫn hiện mục đang xem. */
export function SidebarNav({ nav, pathname, rail, closedGroups, onToggleGroup, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Quản trị" className={cn('flex-1 overflow-y-auto overscroll-contain pb-4', rail ? 'px-2' : 'px-3')}>
      {nav.map((group, gi) => {
        const closed = !rail && closedGroups.includes(group.key);
        const items = closed ? group.items.filter((i) => isNavActive(pathname, i.href)) : group.items;
        const listId = `nav-group-${group.key}`;
        return (
          <div key={group.key} className={cn(rail ? 'py-2' : 'mb-2', rail && gi > 0 && 'border-t border-line')}>
            {!rail && (
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={!closed}
                aria-controls={listId}
                className="flex min-h-9 w-full items-center justify-between rounded-control px-2 text-xs text-muted hover:bg-hall hover:text-ink"
              >
                <span>{group.title}</span>
                <ChevronDown
                  aria-hidden
                  className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', closed && '-rotate-90')}
                />
              </button>
            )}
            <ul id={listId} className={cn(rail && 'flex flex-col items-center gap-1')}>
              {items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = isNavActive(pathname, item.href);
                return (
                  <li key={item.href} className={cn(rail && 'w-full')}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={rail ? item.label : undefined}
                      className={cn(
                        'flex min-h-11 items-center rounded-control text-[0.95rem] transition-colors lg:min-h-10',
                        rail ? 'justify-center' : 'gap-3 px-2',
                        active ? 'bg-ink text-paper' : 'hover:bg-hall',
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className={rail ? 'size-5' : 'size-4'} aria-hidden />
                        {rail && item.badge ? (
                          <span className="absolute -top-1.5 -right-1.5 size-2.5 rounded-full bg-shuttle ring-2 ring-paper" aria-hidden />
                        ) : null}
                      </span>
                      <span className={cn(rail && 'sr-only')}>{item.label}</span>
                      {item.badge ? (
                        <span
                          className={cn(
                            'ml-auto grid min-w-5 place-items-center rounded-full bg-shuttle px-1.5 text-[11px] leading-5 font-semibold text-paper',
                            rail && 'sr-only',
                          )}
                        >
                          {item.badge}
                          <span className="sr-only"> việc chờ</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
