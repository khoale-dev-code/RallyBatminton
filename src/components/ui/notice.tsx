import { CircleAlert, Info } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'info' ? Info : CircleAlert;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'note'}
      className={cn(
        'flex gap-3 rounded-panel p-4 text-sm',
        tone === 'info' && 'bg-hall text-ink',
        tone === 'warning' && 'bg-amber-soft text-amber-deep',
        tone === 'error' && 'bg-shuttle-soft text-shuttle-deep',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
