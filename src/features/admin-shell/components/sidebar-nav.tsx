'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

import { cn } from '@/lib/cn';

import { type NavGroup, type NavGroupKey } from '../nav';

import { NAV_ICONS } from './nav-icons';

/** Rê chuột / chạm giữ trên mục bao lâu thì bắt đầu tải trước cả dữ liệu trang (ms). */
const INTENT_DELAY_MS = 90;

/**
 * Link tải trước TOÀN BỘ trang (cả dữ liệu) khi người dùng tỏ ý muốn mở: rê chuột, chạm, focus bàn phím.
 * Mặc định Next chỉ tải trước khung (loading) của trang động → bấm vào vẫn phải chờ máy chủ đọc dữ liệu.
 * Tải trước khi rê chuột giúp trang thường đã sẵn sàng lúc bấm. Dữ liệu tải trước chỉ dùng trong 30 giây
 * (`staleTimes.static` trong next.config.ts) nên không hiện số liệu cũ.
 */
function IntentLink({ onPointerEnter, onPointerLeave, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [hot, setHot] = useState(false);
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  return (
    <Link
      {...props}
      prefetch={hot ? true : null}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        if (!hot && e.pointerType === 'mouse') timer.current = window.setTimeout(() => setHot(true), INTENT_DELAY_MS);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        cancel();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setHot(true);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        setHot(true);
      }}
    />
  );
}

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
                    <IntentLink
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={rail ? item.label : undefined}
                      className={cn(
                        'flex min-h-11 items-center rounded-control text-[0.95rem] transition-colors lg:min-h-10',
                        rail ? 'justify-center' : 'gap-3 px-2',
                        active
                          ? 'bg-primary text-paper shadow-[0_6px_16px_-10px_rgb(0_75_147/0.8)]'
                          : 'text-ink/85 hover:bg-primary-soft hover:text-primary',
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
                    </IntentLink>
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
