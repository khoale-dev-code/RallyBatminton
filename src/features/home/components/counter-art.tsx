import { cn } from '@/lib/cn';

/** Minh họa vẽ tay (SVG) cho khối "Tại quầy" — không dùng ảnh giả của sản phẩm thật. */

export function DrinksArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={cn('h-full w-full', className)}>
      <ellipse cx="80" cy="112" rx="66" ry="6" fill="#000" opacity="0.08" />
      {/* ly xanh */}
      <path d="M38 34 H82 L76 108 H44 Z" fill="#e8f4e2" stroke="#2b7f21" strokeWidth="2" />
      <path d="M41 58 H79 L76 108 H44 Z" fill="#62bb46" />
      <path d="M41 58 Q60 52 79 58" fill="none" stroke="#2b7f21" strokeWidth="1.5" opacity="0.6" />
      <circle cx="52" cy="76" r="3" fill="#fff" opacity="0.7" />
      <circle cx="66" cy="90" r="2.4" fill="#fff" opacity="0.6" />
      <path d="M68 34 L80 6" stroke="#2b7f21" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="34" r="12" fill="#c7e86a" stroke="#2b7f21" strokeWidth="2" />
      <path d="M40 24 V44 M30 34 H50 M33 27 L47 41 M47 27 L33 41" stroke="#2b7f21" strokeWidth="1" opacity="0.6" />
      {/* ly đỏ */}
      <path d="M90 44 H128 L123 108 H95 Z" fill="#fdecec" stroke="#b5121a" strokeWidth="2" />
      <path d="M92 64 H126 L123 108 H95 Z" fill="#ed1c24" />
      <circle cx="104" cy="82" r="2.6" fill="#fff" opacity="0.7" />
      <circle cx="114" cy="96" r="2" fill="#fff" opacity="0.6" />
      <path d="M116 44 L124 14" stroke="#b5121a" strokeWidth="4" strokeLinecap="round" />
      <path d="M100 44 q8 -14 20 -4" fill="#62bb46" stroke="#2b7f21" strokeWidth="1.5" />
    </svg>
  );
}

export function RacketArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={cn('h-full w-full', className)}>
      <ellipse cx="84" cy="112" rx="66" ry="6" fill="#000" opacity="0.08" />
      {/* vợt */}
      <g transform="rotate(-32 70 60)">
        <ellipse cx="70" cy="34" rx="24" ry="31" fill="none" stroke="#111" strokeWidth="4" />
        <g stroke="#9aa39a" strokeWidth="0.8">
          {[-16, -8, 0, 8, 16].map((x) => (
            <path key={`v${x}`} d={`M${70 + x} ${8 + Math.abs(x) * 0.7} V${60 - Math.abs(x) * 0.7}`} />
          ))}
          {[-20, -10, 0, 10, 20].map((y) => (
            <path key={`h${y}`} d={`M${50 + Math.abs(y) * 0.55} ${34 + y} H${90 - Math.abs(y) * 0.55}`} />
          ))}
        </g>
        <path d="M70 65 V108" stroke="#111" strokeWidth="4" strokeLinecap="round" />
        <rect x="65" y="94" width="10" height="20" rx="3" fill="#ed1c24" />
      </g>
      {/* giày */}
      <path d="M78 96 Q80 80 92 78 L104 74 Q110 82 122 84 L142 90 Q150 94 148 102 L80 104 Q76 102 78 96 Z" fill="#1b1f1c" />
      <path d="M80 102 H148" stroke="#62bb46" strokeWidth="5" strokeLinecap="round" />
      <path d="M96 80 L104 92 M104 78 L112 90" stroke="#fff" strokeWidth="1.6" opacity="0.7" />
      <path d="M118 86 Q128 88 136 96" stroke="#62bb46" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

export function LockerArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={cn('h-full w-full', className)}>
      <ellipse cx="80" cy="113" rx="62" ry="5" fill="#000" opacity="0.08" />
      <rect x="28" y="12" width="104" height="98" rx="4" fill="#b98a5e" />
      <rect x="32" y="16" width="96" height="90" rx="2" fill="#8a603b" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <g key={`${r}${c}`}>
            <rect x={35 + c * 31} y={19 + r * 29} width={28} height={26} rx="2" fill="#d6ad80" />
            <circle cx={57 + c * 31} cy={32 + r * 29} r="1.8" fill="#5b3c22" />
          </g>
        )),
      )}
      <path d="M36 21 H60" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}
