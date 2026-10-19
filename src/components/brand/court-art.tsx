import { cn } from '@/lib/cn';

/**
 * Sân cầu lông nhìn từ trên xuống (tỉ lệ thật 13,4 × 6,1 m) — vạch trắng tự vẽ khi tải trang.
 * Khoảnh khắc chuyển động duy nhất của trang chủ; tắt khi người dùng giảm chuyển động.
 */
export function CourtArt({ className, nextSlot }: { className?: string; nextSlot?: string }) {
  const line =
    'stroke-paper [stroke-dasharray:var(--dash)] [stroke-dashoffset:var(--dash)] motion-safe:animate-draw motion-reduce:[stroke-dashoffset:0]';
  return (
    <figure className={cn('relative', className)}>
      <svg viewBox="0 0 610 1340" role="img" aria-label="Sơ đồ sân cầu lông" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <rect x="0" y="0" width="610" height="1340" rx="18" className="fill-court" />
        <g fill="none" strokeWidth="5" strokeLinecap="square">
          {/* biên dọc đôi & đơn */}
          <path d="M20 20 V1320" className={line} style={{ ['--dash' as string]: 1300 }} />
          <path d="M590 20 V1320" className={line} style={{ ['--dash' as string]: 1300 }} />
          <path d="M66 20 V1320" className={line} style={{ ['--dash' as string]: 1300, animationDelay: '120ms' }} />
          <path d="M544 20 V1320" className={line} style={{ ['--dash' as string]: 1300, animationDelay: '120ms' }} />
          {/* biên ngang, đường giao cầu dài đánh đôi */}
          <path d="M20 20 H590 M20 1320 H590" className={line} style={{ ['--dash' as string]: 600, animationDelay: '240ms' }} />
          <path d="M20 96 H590 M20 1244 H590" className={line} style={{ ['--dash' as string]: 600, animationDelay: '360ms' }} />
          {/* đường giao cầu ngắn */}
          <path d="M20 472 H590 M20 868 H590" className={line} style={{ ['--dash' as string]: 600, animationDelay: '480ms' }} />
          {/* đường giữa */}
          <path d="M305 20 V472 M305 868 V1320" className={line} style={{ ['--dash' as string]: 460, animationDelay: '600ms' }} />
        </g>
        {/* lưới */}
        <path d="M0 670 H610" stroke="#000" strokeWidth="9" />
        <path d="M0 670 H610" stroke="#fff" strokeWidth="2" strokeDasharray="6 10" />
        {/* quả cầu ở ô giao cầu — điểm đỏ duy nhất */}
        <circle cx="430" cy="980" r="16" fill="#ED1C24" className="motion-safe:animate-fade" style={{ animationDelay: '1.2s' }} />
      </svg>
      {nextSlot && (
        <figcaption className="absolute right-3 bottom-3 left-3 rounded-control bg-paper/95 px-4 py-3 text-sm shadow-lift">
          {nextSlot}
        </figcaption>
      )}
    </figure>
  );
}
