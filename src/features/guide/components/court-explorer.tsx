'use client';

import { Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import { gsap, useGSAP } from '@/components/motion/gsap';
import { cn } from '@/lib/cn';

import {
  COURT,
  COURT_MODES,
  courtCaption,
  isServeMode,
  NET_X,
  playArea,
  serveSide,
  serviceBoxes,
  type CourtMode,
  type Rect,
} from '../lib/court';

/** Tỉ lệ vẽ: 1 m = 40 đơn vị SVG. */
const S = 40;
const W = COURT.length * S;
const H = COURT.width * S;
const MAX_SCORE = 30;

interface Point {
  x: number;
  y: number;
}

interface Geometry {
  area: Rect;
  server: Rect;
  target: Rect;
  from: Point;
  to: Point;
  serve: boolean;
}

const px = (r: Rect): Rect => ({ x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S });
const attrs = (r: Rect) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

function geometry(mode: CourtMode, score: number): Geometry {
  const area = px(playArea(mode));
  const serve = isServeMode(mode);
  const boxes = serviceBoxes(mode === 'doubles' || mode === 'serve-doubles' ? 'serve-doubles' : 'serve-singles', score);
  const server = px(boxes.server);
  const target = px(boxes.target);
  return {
    area,
    server,
    target,
    serve,
    // Người giao đứng gần vạch giao cầu ngắn, giữa ô; cầu rơi vào giữa ô đối diện.
    from: { x: server.x + server.w * 0.78, y: server.y + server.h / 2 },
    to: { x: target.x + target.w * 0.45, y: target.y + target.h / 2 },
  };
}

/** Đường bay cong nhẹ (nhìn từ trên xuống) từ người giao tới ô nhận. */
function flightPath(from: Point, to: Point): string {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - Math.abs(to.y - from.y) * 0.35 - 18;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Sơ đồ sân tương tác: bấm Đánh đơn / Đánh đôi / Giao cầu để xem phần sân được dùng.
 * Ở chế độ giao cầu, đổi điểm số để thấy người giao đứng ô phải hay trái.
 */
export function CourtExplorer({ initial = 'singles', className }: { initial?: CourtMode; className?: string }) {
  const [mode, setMode] = useState<CourtMode>(initial);
  const [score, setScore] = useState(0);
  // Giá trị ban đầu cố định: sau lần vẽ đầu, GSAP điều khiển vị trí các khối (React không ghi đè).
  const [first] = useState(() => geometry(initial, 0));
  const root = useRef<HTMLDivElement>(null);
  const g = geometry(mode, score);
  const caption = courtCaption(mode, score);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const d = reducedMotion() ? 0 : 0.55;
      const ease = 'power3.inOut';
      gsap.to(q('[data-area]'), { attr: attrs(g.area), opacity: g.serve ? 0.35 : 1, duration: d, ease });
      gsap.to(q('[data-server]'), { attr: attrs(g.server), opacity: g.serve ? 1 : 0, duration: d, ease });
      gsap.to(q('[data-target]'), { attr: attrs(g.target), opacity: g.serve ? 1 : 0, duration: d, ease });
      gsap.to(q('[data-player]'), { attr: { cx: g.from.x, cy: g.from.y }, opacity: g.serve ? 1 : 0, duration: d, ease });

      const shuttle = q('[data-shuttle]');
      gsap.killTweensOf(shuttle);
      if (!g.serve) {
        gsap.to(shuttle, { opacity: 0, duration: 0.2 });
        return;
      }
      const path = q('[data-flight]')[0];
      if (!(path instanceof SVGPathElement) || d === 0) {
        gsap.set(shuttle, { attr: { cx: g.to.x, cy: g.to.y }, opacity: 1 });
        return;
      }
      const len = path.getTotalLength();
      const at = { t: 0 };
      gsap.set(path, { strokeDashoffset: 0 });
      gsap.set(shuttle, { opacity: 1, attr: { cx: g.from.x, cy: g.from.y } });
      gsap.to(at, {
        t: 1,
        delay: d * 0.6,
        duration: 0.9,
        ease: 'power1.inOut',
        onUpdate: () => {
          const p = path.getPointAtLength(at.t * len);
          gsap.set(shuttle, { attr: { cx: p.x, cy: p.y } });
        },
      });
    },
    { scope: root, dependencies: [mode, score] },
  );

  const serve = isServeMode(mode);
  const side = serveSide(score) === 'right' ? 'phải' : 'trái';

  return (
    <div ref={root} className={cn('flex flex-col gap-3 rounded-[1.5rem] bg-hall-dark p-3 text-paper sm:gap-4 sm:p-5', className)}>
      <div role="group" aria-label="Chế độ sơ đồ sân" className="grid grid-cols-2 gap-1 rounded-xl bg-paper/8 p-1 sm:grid-cols-4">
        {COURT_MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => setMode(m.mode)}
            className={cn(
              'min-h-10 rounded-lg px-2 text-sm font-medium transition-colors',
              mode === m.mode ? 'bg-court text-on-court shadow-sm' : 'text-paper/75 hover:bg-paper/10 hover:text-paper',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <svg viewBox={`-34 -30 ${W + 68} ${H + 62}`} role="img" aria-label={caption} className="h-auto w-full select-none">
        {/* Mặt sân */}
        <rect x={0} y={0} width={W} height={H} fill="#1d4d29" />
        <rect data-area {...attrs(first.area)} fill="#2f8a3a" opacity={first.serve ? 0.35 : 1} />
        <rect data-server {...attrs(first.server)} fill="#ffffff" fillOpacity={0.16} opacity={first.serve ? 1 : 0} />
        <rect data-target {...attrs(first.target)} fill="#62bb46" opacity={first.serve ? 1 : 0} />

        {/* Vạch kẻ */}
        <g fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="square">
          <rect x={0} y={0} width={W} height={H} />
          <path d={`M0 ${COURT.sideAlley * S} H${W} M0 ${H - COURT.sideAlley * S} H${W}`} />
          <path d={`M${(NET_X - COURT.shortService) * S} 0 V${H} M${(NET_X + COURT.shortService) * S} 0 V${H}`} />
          <path d={`M${COURT.doublesLong * S} 0 V${H} M${W - COURT.doublesLong * S} 0 V${H}`} />
          <path d={`M0 ${H / 2} H${(NET_X - COURT.shortService) * S} M${(NET_X + COURT.shortService) * S} ${H / 2} H${W}`} />
        </g>

        {/* Viền ô giao cầu (vẽ trên vạch để luôn thấy rõ) */}
        {serve && (
          <g fill="none" strokeWidth={2.5} strokeDasharray="7 6">
            <rect {...attrs(g.server)} stroke="#ffffff" strokeOpacity={0.9} />
            <rect {...attrs(g.target)} stroke="#ED1C24" />
            <path data-flight d={flightPath(g.from, g.to)} stroke="#ffffff" strokeOpacity={0.55} strokeDasharray="3 7" />
          </g>
        )}

        {/* Lưới */}
        <line x1={NET_X * S} x2={NET_X * S} y1={-10} y2={H + 10} stroke="#ffffff" strokeWidth={5} />
        <circle cx={NET_X * S} cy={-10} r={5} fill="#ffffff" />
        <circle cx={NET_X * S} cy={H + 10} r={5} fill="#ffffff" />

        <circle
          data-player
          cx={first.from.x}
          cy={first.from.y}
          r={10}
          fill="#000000"
          stroke="#ffffff"
          strokeWidth={3}
          opacity={first.serve ? 1 : 0}
        />
        <circle data-shuttle cx={first.to.x} cy={first.to.y} r={7} fill="#ED1C24" stroke="#ffffff" strokeWidth={2} opacity={0} />

        {/* Nhãn */}
        <g fill="currentColor" className="text-paper/70" fontSize={12} fontFamily="inherit">
          <text x={NET_X * S} y={-16} textAnchor="middle" fontWeight={600} letterSpacing={1.5}>
            LƯỚI
          </text>
          <g className="hidden sm:inline">
            <text x={W * 0.25} y={H + 26} textAnchor="middle">
              13,4 m
            </text>
            <text x={-14} y={H / 2} textAnchor="middle" transform={`rotate(-90 -14 ${H / 2})`}>
              6,1 m
            </text>
            <text x={(NET_X + COURT.shortService / 2) * S} y={H + 26} textAnchor="middle">
              1,98 m
            </text>
            <text x={W - (COURT.doublesLong / 2) * S} y={-16} textAnchor="middle">
              0,76 m
            </text>
          </g>
        </g>
      </svg>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-paper/75">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm bg-[#2f8a3a] ring-1 ring-paper/40" />
            Phần sân được dùng
          </li>
          {serve && (
            <>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-sm border border-dashed border-paper bg-paper/15" />Ô đứng giao
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-sm border border-dashed border-shuttle bg-court" />Ô cầu phải rơi vào
              </li>
            </>
          )}
        </ul>
        {serve && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-sm text-paper/75">Điểm bên giao</span>
            <div className="flex items-center rounded-full bg-paper/10 p-0.5">
              <button
                type="button"
                aria-label="Bớt 1 điểm"
                disabled={score === 0}
                onClick={() => setScore((s) => Math.max(0, s - 1))}
                className="grid size-9 place-items-center rounded-full transition-colors hover:bg-paper/15 disabled:opacity-35"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <output aria-live="polite" className="w-9 text-center font-display text-xl tabular">
                {score}
              </output>
              <button
                type="button"
                aria-label="Thêm 1 điểm"
                disabled={score === MAX_SCORE}
                onClick={() => setScore((s) => Math.min(MAX_SCORE, s + 1))}
                className="grid size-9 place-items-center rounded-full transition-colors hover:bg-paper/15 disabled:opacity-35"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                side === 'phải' ? 'bg-court text-on-court' : 'bg-shuttle text-paper',
              )}
            >
              Ô {side}
            </span>
          </div>
        )}
      </div>
      <p aria-live="polite" className="px-1 text-sm leading-relaxed text-paper/85">
        {caption}
      </p>
    </div>
  );
}
