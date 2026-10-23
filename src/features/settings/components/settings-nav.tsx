'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';

import { isSettingsSection, SETTINGS_SECTIONS, type SettingsSectionId } from '../lib/sections';

/**
 * Mục lục trang Cài đặt — mỗi lần chỉ hiện một mục (trang ngắn, dễ dùng trên điện thoại).
 * Máy tính: cột trái dính khi cuộn; điện thoại: hàng chip cuộn ngang dính dưới thanh trên.
 */
export function SettingsNav({ active }: { active: SettingsSectionId }) {
  const router = useRouter();
  // Liên kết cũ dạng /admin/settings#thue → chuyển sang đúng mục.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hash !== active && isSettingsSection(hash)) router.replace(`/admin/settings?muc=${hash}`, { scroll: false });
  }, [active, router]);

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
              <Link
                href={`/admin/settings?muc=${s.id}`}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-2.5 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors xl:rounded-control xl:border-0 xl:px-3',
                  on
                    ? 'border-primary bg-primary text-paper xl:bg-primary-soft xl:font-medium xl:text-primary'
                    : 'border-line bg-paper text-ink/80 hover:text-primary xl:bg-transparent xl:hover:bg-paper',
                )}
              >
                <s.icon className="size-4 shrink-0" aria-hidden />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
