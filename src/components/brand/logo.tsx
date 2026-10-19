import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/cn';

/** Biểu tượng tròn (quả cầu trên nền xanh) — dùng ở thanh quản trị thu gọn, chân trang, favicon. */
export function ShuttleMark({ className }: { className?: string }) {
  return (
    <Image src="/brand/rally-icon.png" alt="" width={64} height={64} aria-hidden className={cn('shrink-0 object-contain', className)} />
  );
}

/** Logo chữ "Rally" (chữ R là quả cầu, chữ l là cây vợt). */
export function Wordmark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/rally-logo.png"
      alt="Rally"
      width={270}
      height={120}
      priority={priority}
      className={cn('h-10 w-auto shrink-0 object-contain', className)}
    />
  );
}

export function Logo({ href = '/', className, label }: { href?: string; className?: string; label?: string }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 rounded-control', className)} aria-label="Rally Badminton — trang chủ">
      <Wordmark priority />
      {label && <span className="font-display text-lg leading-none text-muted">{label}</span>}
    </Link>
  );
}
