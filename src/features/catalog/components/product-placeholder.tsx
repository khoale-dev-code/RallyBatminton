import { CupSoda, Footprints, Package, Shirt, ShoppingBag, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

function RacketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <ellipse cx="29" cy="15" rx="10" ry="12.5" transform="rotate(35 29 15)" />
      <path d="M22.5 13.5 l11 -6 M24 19 l12 -6.5 M24.5 9.5 l7 10 M20.5 12.5 l7 10" strokeWidth="1.2" opacity="0.7" />
      <path d="M21 25 L8 41" />
      <path d="M8 41 l-2.5 2.5" strokeWidth="4" />
    </svg>
  );
}

function ShuttleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M14 30 L6 8 M19 29 L17 5 M24 29 L28 5 M29 30 L39 9 M6 8 Q22 2 39 9" />
      <path d="M12 21 Q22 17 33 21" strokeWidth="1.4" opacity="0.7" />
      <circle cx="21.5" cy="36" r="7" fill="#ED1C24" stroke="none" />
    </svg>
  );
}

type Visual = { icon: LucideIcon | typeof RacketIcon; tone: string };

/** Biểu tượng & nền theo nhóm hàng (so theo tên nhóm, không phân biệt dấu/hoa thường). */
function visualFor(category: string | null, kind: 'sale' | 'rental'): Visual {
  const c = (category ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
  if (c.includes('vot')) return { icon: RacketIcon, tone: 'from-court-soft to-[#d6efcb] text-court-deep' };
  if (c.includes('cau')) return { icon: ShuttleIcon, tone: 'from-[#f1f6ee] to-court-soft text-ink' };
  if (c.includes('giay')) return { icon: Footprints, tone: 'from-[#eef2f6] to-[#dde6ef] text-ink' };
  if (c.includes('quan') || c.includes('ao')) return { icon: Shirt, tone: 'from-[#f4f1ec] to-[#e9e2d6] text-ink' };
  if (c.includes('uong') || c.includes('nuoc')) return { icon: CupSoda, tone: 'from-[#e8f3fb] to-[#cfe6f6] text-[#1d5d8a]' };
  if (c.includes('phu kien')) return { icon: Package, tone: 'from-shuttle-soft to-[#f9d9d9] text-shuttle-deep' };
  return { icon: kind === 'rental' ? RacketIcon : ShoppingBag, tone: 'from-hall to-court-soft text-court-deep' };
}

/** Ảnh tạm khi sản phẩm chưa có ảnh: nền dịu theo nhóm hàng + biểu tượng + tên ngắn (không dùng ảnh giả). */
export function ProductPlaceholder({
  name,
  category,
  kind,
  className,
}: {
  name: string;
  category: string | null;
  kind: 'sale' | 'rental';
  className?: string;
}) {
  const { icon: Icon, tone } = visualFor(category, kind);
  return (
    <div
      role="img"
      aria-label={`${name} (chưa có ảnh)`}
      className={cn('relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br', tone, className)}
    >
      <svg aria-hidden viewBox="0 0 200 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-[0.12]">
        <path d="M0 110 L200 40 M0 150 L200 80 M60 150 L200 110" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="relative grid size-20 place-items-center rounded-full bg-paper/70 shadow-sm ring-1 ring-black/5 sm:size-24">
        <Icon className="size-10 sm:size-12" strokeWidth={1.6} />
      </span>
    </div>
  );
}
