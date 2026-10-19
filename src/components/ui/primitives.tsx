import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { type Tone } from '@/lib/labels';

const TONES: Record<Tone, string> = {
  neutral: 'bg-hall text-muted',
  green: 'bg-court-soft text-court-deep',
  red: 'bg-shuttle-soft text-shuttle-deep',
  amber: 'bg-amber-soft text-amber-deep',
  ink: 'bg-ink text-paper',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}
    >
      {children}
    </span>
  );
}

interface PanelProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Panel({ title, description, actions, children, className, id }: PanelProps) {
  return (
    <section id={id} className={cn('min-w-0 rounded-panel border border-line bg-paper p-4 sm:p-6', className)}>
      {(title ?? actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-xl">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && <div className="mb-1.5 sm:mb-2">{back}</div>}
        <h1 className="text-[1.75rem] break-words sm:text-4xl">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-[0.95rem] text-muted sm:mt-2 sm:text-base">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line bg-hall/60 p-5 sm:p-6">
      <p className="font-display text-lg">{title}</p>
      {children && <div className="max-w-prose text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

/** Khối thông tin dạng nhãn → giá trị */
export function DescriptionList({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 border-b border-line/70 pb-2">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="font-medium break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Mở rộng tại chỗ không cần JavaScript (thao tác phụ trên trang chi tiết). */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  tone = 'default',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <details open={defaultOpen} className="group rounded-panel border border-line bg-paper">
      <summary
        className={cn(
          'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium select-none',
          '[&::-webkit-details-marker]:hidden',
          tone === 'danger' && 'text-shuttle-deep',
        )}
      >
        {summary}
        <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm leading-snug text-muted">{label}</span>
      <span className="font-display text-2xl leading-tight break-words tabular sm:text-3xl">{value}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}
