import { ChevronDown, type LucideIcon } from 'lucide-react';
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
    <section id={id} aria-labelledby={`${id}-title`} className="rounded-panel border border-line bg-paper">
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
        {aside && (
          <>
            {/* Điện thoại: hướng dẫn thu gọn để trang ngắn; máy tính: luôn hiện bên phải. */}
            <details className="group min-w-0 rounded-control border border-line lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                Hướng dẫn
                <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-2 pb-2">{aside}</div>
            </details>
            <aside className="hidden min-w-0 lg:block">{aside}</aside>
          </>
        )}
      </div>
    </section>
  );
}
