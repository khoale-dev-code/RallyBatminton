'use client';

import { Bell, ClockCheck, Gauge, Landmark, Palette, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

export const SETTINGS_SECTIONS = [
  { id: 'thuong-hieu', label: 'Thương hiệu', icon: Palette },
  { id: 'chuyen-khoan', label: 'Chuyển khoản SePay', icon: Landmark },
  { id: 'thong-bao', label: 'Email cảnh báo', icon: Bell },
  { id: 'thue', label: 'Thuế', icon: Receipt },
  { id: 'cham-cong', label: 'Chấm công', icon: ClockCheck },
  { id: 'toc-do', label: 'Tốc độ máy chủ', icon: Gauge },
] as const;

/**
 * Mục lục trang Cài đặt: máy tính — cột trái dính khi cuộn; điện thoại — hàng chip cuộn ngang dính dưới thanh trên.
 * Tô đậm mục đang xem (IntersectionObserver, không lắng nghe sự kiện cuộn → mượt).
 */
export function SettingsNav() {
  const [active, setActive] = useState<string>(SETTINGS_SECTIONS[0].id);

  useEffect(() => {
    const els = SETTINGS_SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Mục cài đặt"
      className="sticky top-14 z-20 -mx-4 mb-2 border-b border-line bg-hall/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 xl:top-6 xl:mx-0 xl:mb-0 xl:self-start xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none"
    >
      <ul className="scrollbar-none flex gap-1.5 overflow-x-auto xl:flex-col xl:gap-1 xl:overflow-visible">
        {SETTINGS_SECTIONS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={() => setActive(s.id)}
                aria-current={on ? 'location' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-2.5 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors xl:rounded-control xl:border-0 xl:px-3',
                  on
                    ? 'border-primary bg-primary text-paper xl:bg-primary-soft xl:font-medium xl:text-primary'
                    : 'border-line bg-paper text-ink/80 hover:text-primary xl:bg-transparent xl:hover:bg-paper',
                )}
              >
                <s.icon className="size-4 shrink-0" aria-hidden />
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
