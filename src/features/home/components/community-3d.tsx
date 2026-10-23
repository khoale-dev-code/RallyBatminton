'use client';

import { ArrowRight, ArrowUpRight, CircleDot, RotateCcw, UsersRound } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const ThreeScene = dynamic(
  () => import('./community-three-scene').then((m) => m.CommunityThreeScene),
  { ssr: false },
);

function StaticCourt({ view }: { view: 'perspective' | 'top' }) {
  return (
    <svg className="r3d-static-court" viewBox="0 0 600 560" role="img" aria-label="Sân cầu lông nhìn theo phối cảnh, có đường kẻ và lưới">
      <defs>
        <linearGradient id="r3d-fallback-floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#176e55" /><stop offset="1" stopColor="#063f32" />
        </linearGradient>
        <filter id="r3d-fallback-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g transform={view === 'top' ? 'translate(0 0)' : 'translate(300 280) rotate(-28) skewX(-15) scale(1 .64) translate(-300 -280)'}>
        <rect x="106" y="42" width="388" height="480" rx="17" fill="#0b3027" stroke="#3d805d" strokeWidth="10" />
        <rect x="118" y="54" width="364" height="456" fill="url(#r3d-fallback-floor)" />
        <path d="M125 62H475V502H125Z M151 62V502 M449 62V502 M125 110H475 M125 454H475 M125 202H475 M125 362H475 M300 62V202 M300 362V502" fill="none" stroke="#cfff9a" strokeWidth="5" opacity=".35" filter="url(#r3d-fallback-glow)" />
        <path d="M125 62H475V502H125Z M151 62V502 M449 62V502 M125 110H475 M125 454H475 M125 202H475 M125 362H475 M300 62V202 M300 362V502" fill="none" stroke="#ddffe2" strokeWidth="3.4" />
        <path d="M118 280H482" stroke="#f8fff2" strokeWidth="9" />
        <path d="M118 270H482 M118 258H482 M118 247H482 M118 235H482" stroke="#e6fff6" strokeOpacity=".35" strokeWidth="1.6" />
        <path d="M118 232V280 M152 232V280 M186 232V280 M220 232V280 M254 232V280 M288 232V280 M322 232V280 M356 232V280 M390 232V280 M424 232V280 M458 232V280 M482 232V280" stroke="#e6fff6" strokeOpacity=".42" strokeWidth="1.4" />
        <circle cx="225" cy="154" r="9" fill="#c6ff78"/><circle cx="365" cy="407" r="9" fill="#fff6b0" />
      </g>
      <g transform="translate(420 80) rotate(-17)">
        <path d="M0 0L-25 -61Q-19 -73 -12 -67L4 -8Z M0 0L-9 -71Q0 -80 6 -70L10 -7Z M0 0L10 -69Q20 -76 23 -64L15 -2Z" fill="#e6fff4" opacity=".9" />
        <rect x="-12" y="-7" width="28" height="21" rx="9" fill="#e9dfc1" />
      </g>
    </svg>
  );
}

/** One section, three.js loaded only when the visitor scrolls near it. */
export function Community3D() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [show3d, setShow3d] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>('perspective');

  useEffect(() => {
    if (!stageRef.current || typeof IntersectionObserver === 'undefined') {
      setShow3d(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShow3d(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="cong-dong" aria-labelledby="community-title" className="r3d-community full-bleed relative isolate overflow-hidden text-white">
      <div className="r3d-grain" aria-hidden="true" />
      <div className="r3d-aurora" aria-hidden="true" />
      <div className="r3d-shell relative mx-auto grid max-w-7xl gap-7 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:items-center lg:gap-7 lg:py-24">
        <div className="r3d-copy relative z-20">
          <div className="r3d-eyebrow mb-6 inline-flex items-center gap-3 text-[0.68rem] font-bold tracking-[0.21em] uppercase sm:mb-8">
            <span className="r3d-eyebrow-dot" aria-hidden="true" />
            <span>04 / CỘNG ĐỒNG RALLY</span>
            <span className="r3d-eyebrow-line" aria-hidden="true" />
          </div>
          <h2 id="community-title" className="r3d-heading max-w-[10ch] text-[clamp(3.3rem,6.2vw,6.9rem)] leading-[0.99] tracking-[-0.037em]">
            Không chỉ là <span className="r3d-heading-green">một trận cầu.</span>
          </h2>
          <p className="r3d-lead mt-6 max-w-[31.5rem] text-base leading-7 sm:text-lg sm:leading-8">
            Những cuộc hẹn sau giờ làm. Những pha cầu đáng nhớ. Và những người bạn mới. Tất cả bắt đầu từ một trận đấu tại Rally.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/branches" className="r3d-primary inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl px-6 text-sm font-bold sm:text-base">
              Tìm sân gần bạn <ArrowUpRight className="size-5" aria-hidden />
            </Link>
            <Link href="/guide" className="r3d-secondary inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold sm:text-base">
              Khám phá cẩm nang <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="r3d-highlights mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/12 pt-6 text-xs font-medium sm:text-sm">
            <span className="inline-flex items-center gap-2"><UsersRound className="size-4 text-[#baff73]" aria-hidden /> Kết nối đồng đội</span>
            <span className="inline-flex items-center gap-2"><CircleDot className="size-4 text-[#baff73]" aria-hidden /> Chơi hay, vui hơn</span>
          </div>
        </div>

        <div className="r3d-visual relative min-w-0" ref={stageRef} role="group" aria-label="Sân cầu lông 3D Rally tương tác">
          <div className="r3d-stage-glow" aria-hidden="true" />
          <div className="r3d-stage-ring r3d-ring-one" aria-hidden="true" />
          <div className="r3d-stage-ring r3d-ring-two" aria-hidden="true" />
          <div className={`r3d-fallback ${ready ? 'r3d-fallback-hidden' : ''}`} aria-hidden="true"><StaticCourt view={view} /></div>
          {show3d && !failed && <ThreeScene view={view} onReady={() => setReady(true)} onError={() => { setFailed(true); setReady(false); }} />}

          <div className="r3d-label-top absolute left-2 top-5 z-10 flex items-center gap-2 rounded-full px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em] sm:left-5 sm:top-8">
            <span className="size-1.5 rounded-full bg-[#baff73] shadow-[0_0_13px_#baff73]" />
            {failed ? 'COURT / LITE' : 'RALLY / COURT 3D'}
          </div>
          <div className="r3d-mini-stamp absolute bottom-16 left-3 z-10 sm:bottom-20 sm:left-5">
            <span className="block text-[0.57rem] font-bold uppercase tracking-[0.22em] text-[#bcff95]">MORE THAN A GAME</span>
            <strong className="mt-1 block text-[2rem] leading-none sm:text-[2.4rem]">GAME ON<span className="text-[#baff73]">.</span></strong>
          </div>
          <button type="button" className="r3d-view-button absolute bottom-4 right-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold sm:bottom-5 sm:right-5 sm:text-sm"
            aria-label={view === 'top' ? 'Chuyển sang góc nhìn 3D' : 'Xem sân từ trên xuống'} aria-pressed={view === 'top'}
            onClick={() => setView((v) => v === 'top' ? 'perspective' : 'top')}>
            <RotateCcw className="size-4" aria-hidden /> {view === 'top' ? 'Góc nhìn 3D' : 'Xem từ trên'}
          </button>
          <p className="r3d-hint absolute bottom-5 left-5 z-10 hidden text-[0.65rem] tracking-wide text-white/50 xl:block" aria-hidden="true">{ready ? 'KÉO CHUỘT ĐỂ XOAY · WEBGL' : 'MÔ HÌNH SÂN CẦU LÔNG'}</p>
        </div>
      </div>
      <div className="r3d-bottom-line" aria-hidden="true" />
    </section>
  );
}
