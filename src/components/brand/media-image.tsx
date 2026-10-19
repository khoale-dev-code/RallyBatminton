import Image from 'next/image';

import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/storage';

interface MediaImageProps {
  path: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Chữ hiển thị trên ảnh giữ chỗ khi chưa có ảnh thật */
  fallbackLabel?: string;
}

/** Ảnh từ Supabase Storage; chưa có ảnh thì hiện mặt sân kẻ vạch thay vì ảnh minh họa giả. */
export function MediaImage({ path, alt, className, sizes = '(min-width: 1024px) 33vw, 100vw', priority, fallbackLabel }: MediaImageProps) {
  const src = mediaUrl(path);
  if (!src) {
    return (
      <div
        className={cn('relative flex items-end overflow-hidden bg-court-soft', className)}
        role="img"
        aria-label={`${alt} (chưa có ảnh)`}
      >
        <svg viewBox="0 0 200 120" aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="#62BB46" strokeWidth="2">
            <rect x="10" y="10" width="180" height="100" />
            <path d="M100 10 V110 M10 40 H190 M10 80 H190 M24 10 V110 M176 10 V110" />
          </g>
        </svg>
        {fallbackLabel && <span className="relative m-3 font-display text-lg text-court-deep">{fallbackLabel}</span>}
      </div>
    );
  }
  return (
    <div className={cn('relative overflow-hidden bg-hall', className)}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
