'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface CollapsibleSectionProps {
  title: string;
  description?: ReactNode;
  /** Tóm tắt ngắn hiện ở tiêu đề (ví dụ "3 biến thể") — hữu ích khi khung đang thu gọn. */
  summary?: ReactNode;
  /** Thao tác phụ bên phải tiêu đề (không đóng/mở khung khi bấm). */
  actions?: ReactNode;
  /** Điều khiển từ ngoài (mở khung có lỗi khi lưu). Bỏ trống = tự quản lý. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Khung nội dung có thể thu gọn để màn hình quản lý gọn hơn.
 * Nội dung khi đóng chỉ bị ẩn (không bị gỡ), nên dữ liệu đang nhập được giữ nguyên.
 */
export function CollapsibleSection({
  title,
  description,
  summary,
  actions,
  open,
  onOpenChange,
  defaultOpen = true,
  id,
  className,
  children,
}: CollapsibleSectionProps) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const regionId = useId();
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };

  return (
    <section id={id} className={cn('min-w-0 scroll-mt-20 rounded-panel border border-line bg-paper', className)}>
      <div className="flex items-start gap-2 px-4 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={regionId}
          className="group flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-snug sm:text-xl">{title}</span>
            {description && isOpen && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
          </span>
          {summary && !isOpen && <span className="max-w-[45%] truncate text-sm text-muted">{summary}</span>}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-5 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none',
              isOpen && 'rotate-180',
            )}
          />
        </button>
        {actions && <div className="flex min-h-14 shrink-0 items-center">{actions}</div>}
      </div>
      <div id={regionId} hidden={!isOpen} className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
        {children}
      </div>
    </section>
  );
}
