import { cn } from '@/lib/cn';

/**
 * Nhà thi đấu cầu lông vẽ bằng SVG (phối cảnh 1 điểm tụ): trần đèn, tường xanh, 3 sân kẻ vạch, lưới.
 * Dùng làm ảnh hero / ảnh thẻ khi chi nhánh chưa có ảnh thật — nhẹ, sắc nét ở mọi kích thước.
 */

const VX = 600; // điểm tụ ngang
const HORIZON = 300; // đường chân trời
const EYE = 4; // độ cao mắt (m)
const FOCAL = 520;

function project(x: number, z: number, height = 0): [number, number] {
  return [VX + (x * FOCAL) / z, HORIZON + ((EYE - height) * FOCAL) / z];
}

function pt(x: number, z: number, height = 0): string {
  const [a, b] = project(x, z, height);
  return `${a.toFixed(1)},${b.toFixed(1)}`;
}

function line(x1: number, z1: number, x2: number, z2: number): string {
  return `M${pt(x1, z1)} L${pt(x2, z2)}`;
}

/** Vạch sân đôi (mét) — sân dài 13,4 m, rộng 6,1 m; z = khoảng cách tới mắt. */
function courtPaths(cx: number, zNear: number): { surface: string; lines: string; net: { band: string; mesh: string; posts: string } } {
  const zFar = zNear + 13.4;
  const zNet = zNear + 6.7;
  const half = 3.05;
  const single = 2.59;
  const surface = `M${pt(cx - half - 0.4, zNear - 0.4)} L${pt(cx + half + 0.4, zNear - 0.4)} L${pt(cx + half + 0.4, zFar + 0.4)} L${pt(cx - half - 0.4, zFar + 0.4)} Z`;
  const l: string[] = [
    line(cx - half, zNear, cx + half, zNear),
    line(cx - half, zFar, cx + half, zFar),
    line(cx - half, zNear, cx - half, zFar),
    line(cx + half, zNear, cx + half, zFar),
    line(cx - single, zNear, cx - single, zFar),
    line(cx + single, zNear, cx + single, zFar),
    line(cx - half, zNet - 1.98, cx + half, zNet - 1.98),
    line(cx - half, zNet + 1.98, cx + half, zNet + 1.98),
    line(cx - half, zNear + 0.76, cx + half, zNear + 0.76),
    line(cx - half, zFar - 0.76, cx + half, zFar - 0.76),
    line(cx, zNear, cx, zNet - 1.98),
    line(cx, zNet + 1.98, cx, zFar),
  ];
  const [lx, lyTop] = project(cx - half, zNet, 1.55);
  const [rx, ryTop] = project(cx + half, zNet, 1.55);
  const [, lyMeshBottom] = project(cx - half, zNet, 0.79);
  const [, lyFloor] = project(cx - half, zNet, 0);
  return {
    surface,
    lines: l.join(' '),
    net: {
      band: `M${lx.toFixed(1)},${lyTop.toFixed(1)} L${rx.toFixed(1)},${ryTop.toFixed(1)}`,
      mesh: `M${lx.toFixed(1)},${lyTop.toFixed(1)} L${rx.toFixed(1)},${ryTop.toFixed(1)} L${rx.toFixed(1)},${lyMeshBottom.toFixed(1)} L${lx.toFixed(1)},${lyMeshBottom.toFixed(1)} Z`,
      posts: `M${lx.toFixed(1)},${lyTop.toFixed(1)} V${lyFloor.toFixed(1)} M${rx.toFixed(1)},${ryTop.toFixed(1)} V${lyFloor.toFixed(1)}`,
    },
  };
}

const COURTS = [-7.6, 0, 7.6].map((cx) => courtPaths(cx, 5.2));

/** Hàng đèn trần (đèn tấm) theo phối cảnh. */
const LIGHTS = [
  { y: 38, step: 210, w: 96, h: 9 },
  { y: 90, step: 158, w: 64, h: 6.5 },
  { y: 124, step: 118, w: 42, h: 4.5 },
  { y: 143, step: 88, w: 26, h: 3 },
].flatMap((row) => {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let x = VX - Math.floor(VX / row.step) * row.step; x <= 1200; x += row.step) out.push({ x, y: row.y, w: row.w, h: row.h });
  return out;
});

export function HallScene({
  className,
  showSlogan = true,
  title = 'Nhà thi đấu cầu lông Rally',
  decorClassName,
}: {
  className?: string;
  showSlogan?: boolean;
  title?: string;
  /** Lớp cho logo + khẩu hiệu trên tường (ví dụ ẩn ở màn nhỏ khi chữ đè lên). */
  decorClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 1200 640"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={title}
      className={cn('block h-full w-full', className)}
    >
      <defs>
        <linearGradient id="hall-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#06180f" />
          <stop offset="0.24" stopColor="#0b2d1f" />
          <stop offset="0.6" stopColor="#0f3d2a" />
          <stop offset="1" stopColor="#124a33" />
        </linearGradient>
        <linearGradient id="hall-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14583a" />
          <stop offset="1" stopColor="#1b7a4d" />
        </linearGradient>
        <linearGradient id="hall-court" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#177a50" />
          <stop offset="1" stopColor="#21a065" />
        </linearGradient>
        <radialGradient id="hall-glow">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#e9fff1" stopOpacity="0.28" />
          <stop offset="1" stopColor="#e9fff1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hall-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern id="hall-net" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M6 0 L0 6" stroke="#0a1f15" strokeWidth="0.8" opacity="0.7" />
        </pattern>
      </defs>

      <rect width="1200" height="640" fill="url(#hall-wall)" />
      {/* Trần: dầm hội tụ về điểm tụ */}
      <g stroke="#1b4433" strokeWidth="1.2" opacity="0.6">
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${i * 100} 0 L${VX + (i * 100 - VX) * 0.62} 150`} />
        ))}
        <path d="M0 150 H1200 M0 120 H1200 M0 84 H1200" />
      </g>
      {/* Tường sau: tấm ốp */}
      <g>
        {Array.from({ length: 30 }, (_, i) => (
          <rect key={i} x={i * 40} y={150} width={38} height={232} fill={i % 2 ? '#0f4029' : '#11462e'} opacity="0.9" />
        ))}
        <rect x="0" y="150" width="1200" height="18" fill="#0a2a1c" />
        <rect x="0" y="358" width="1200" height="24" fill="#0c3322" />
      </g>
      {/* Đèn trần */}
      <g>
        {LIGHTS.map((l, i) => (
          <g key={i}>
            <ellipse cx={l.x} cy={l.y + l.h} rx={l.w * 1.1} ry={l.w * 0.55} fill="url(#hall-glow)" />
            <rect x={l.x - l.w / 2} y={l.y} width={l.w} height={l.h} rx={l.h / 2} fill="#ffffff" />
          </g>
        ))}
      </g>
      {/* Sàn & sân */}
      <rect x="0" y="380" width="1200" height="260" fill="url(#hall-floor)" />
      {COURTS.map((c, i) => (
        <path key={i} d={c.surface} fill="url(#hall-court)" />
      ))}
      <g stroke="#f4fff7" strokeWidth="2.2" fill="none" strokeLinecap="square" opacity="0.92">
        {COURTS.map((c, i) => (
          <path key={i} d={c.lines} />
        ))}
      </g>
      {/* Phản chiếu đèn trên sàn */}
      <g fill="#ffffff" opacity="0.07">
        <ellipse cx="600" cy="470" rx="420" ry="40" />
        <ellipse cx="600" cy="560" rx="520" ry="30" />
      </g>
      {/* Lưới */}
      {COURTS.map((c, i) => (
        <g key={i}>
          <path d={c.net.mesh} fill="url(#hall-net)" />
          <path d={c.net.mesh} fill="#0a1f15" opacity="0.18" />
          <path d={c.net.band} stroke="#ffffff" strokeWidth="2.4" />
          <path d={c.net.posts} stroke="#0a1f15" strokeWidth="3" />
        </g>
      ))}
      <rect width="1200" height="640" fill="url(#hall-haze)" />

      {/* Logo trên tường */}
      <g transform="translate(560 214)" opacity="0.95" className={decorClassName}>
        <g transform="scale(1.6)" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d="M9 22 L4 6 M12 21 L11 4 M16 20.5 L18 4 M19.5 20 L25 6 M4 6 Q14 2 25 6" />
        </g>
        <circle cx="23" cy="39" r="8.5" fill="#ED1C24" />
        <text x="58" y="44" fill="#ffffff" fontFamily="Oswald, 'Arial Narrow', sans-serif" fontSize="50" fontWeight="600">
          Rally
        </text>
      </g>
      {showSlogan && (
        <g
          transform="translate(930 205) rotate(-9)"
          className={cn(decorClassName, 'max-xl:hidden')}
          fill="#ffffff"
          fontFamily="'Segoe Script', 'Brush Script MT', cursive"
          fontStyle="italic"
          fontSize="34"
          opacity="0.92"
        >
          <text x="0" y="0">
            Play
          </text>
          <text x="18" y="40">
            More
          </text>
          <text x="-4" y="80">
            Together
          </text>
        </g>
      )}
    </svg>
  );
}
