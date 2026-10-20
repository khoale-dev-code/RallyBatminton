import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Một mục của trang Cài đặt: tiêu đề có biểu tượng, nội dung chính bên trái, hướng dẫn / trạng thái bên phải. */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 rounded-panel border border-line bg-paper xl:scroll-mt-6">
      <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-xl">
            {title}
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">{description}</p>
        </div>
      </header>
      <div
        className={cn(
          'grid gap-6 p-4 sm:p-6',
          Boolean(aside) && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] 2xl:grid-cols-[minmax(0,1fr)_24rem]',
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside && <aside className="min-w-0">{aside}</aside>}
      </div>
    </section>
  );
}
