import Link from 'next/link';

import { cn } from '@/lib/cn';

export interface LinkTab {
  href: string;
  label: string;
  active: boolean;
}

/** Thanh tab dạng liên kết (giữ trạng thái trên URL, hoạt động không cần JavaScript). */
export function LinkTabs({ tabs, label }: { tabs: LinkTab[]; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[0.95rem] whitespace-nowrap',
            t.active ? 'border-ink font-medium' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
