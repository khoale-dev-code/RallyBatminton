'use client';

import { Minus, Pause, Play, Plus, RotateCcw, ScanEye, Map } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { cn } from '@/lib/cn';
import { COURT, COURT_MODES, courtCaption, isServeMode, serviceBoxes, serveSide, type CourtMode } from '../lib/court';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia?.(REDUCED_MOTION);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}
const readReducedMotion = () => window.matchMedia?.(REDUCED_MOTION).matches ?? false;

import '../court-arena-3d.css';

const ArenaScene = dynamic(() => import('./court-arena-three').then((m) => m.CourtArenaScene), { ssr: false });

type View = 'angle' | 'top';

function PlanB({ mode, score }: { mode: CourtMode; score: number }) {
  const x0 = 74, y0 = 46, len = 630, width = 288;
  const px = (a: number) => x0 + a / COURT.length * len;
  const py = (a: number) => y0 + a / COURT.width * width;
  const serve = isServeMode(mode);
  const boxes = serviceBoxes(mode === 'serve-doubles' || mode === 'doubles' ? 'serve-doubles' : 'serve-singles', score);
  const rect = (r: {x:number;y:number;w:number;h:number}) => ({ x:px(r.x),y:py(r.y),width:r.w/COURT.length*len,height:r.h/COURT.width*width });
  const [a,b] = [boxes.server, boxes.target];
  return (
    <svg viewBox="0 0 780 382" className="rga-plan" role="img" aria-label={`Sơ đồ sân cầu lông 2D: ${courtCaption(mode,score)}`}>
      <defs><linearGradient id="rga-fallback-green" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#116c47"/><stop offset="1" stopColor="#05412e"/></linearGradient></defs>
      <rect width="780" height="382" rx="14" fill="#092d24"/>
      <rect x={x0-9} y={y0-9} width={len+18} height={width+18} fill="#033324" rx="8"/>
      <rect x={x0} y={y0} width={len} height={width} fill="url(#rga-fallback-green)"/>
      {(mode === 'singles'||mode === 'serve-singles') && <><rect x={x0} y={y0} width={len} height={py(COURT.sideAlley)-y0} fill="#062921" opacity=".65"/><rect x={x0} y={py(COURT.width-COURT.sideAlley)} width={len} height={py(COURT.sideAlley)-y0} fill="#062921" opacity=".65"/></>}
      {serve && <><rect {...rect(a)} fill="#ffffff" fillOpacity=".13" stroke="#d3ff8c" strokeWidth="2" strokeDasharray="7 6"/><rect {...rect(b)} fill="#9ddf55" fillOpacity=".36" stroke="#e31837" strokeWidth="3" strokeDasharray="8 5"/></>}
      <g stroke="#f8fff9" strokeWidth="2" fill="none">
        <rect x={x0} y={y0} width={len} height={width}/>
        <path d={`M${x0} ${py(.46)}H${x0+len} M${x0} ${py(5.64)}H${x0+len}`}/>
        <path d={`M${px(1.98+COURT.length/2)} ${y0}V${y0+width} M${px(COURT.length/2-1.98)} ${y0}V${y0+width}`}/>
        <path d={`M${px(.76)} ${y0}V${y0+width} M${px(COURT.length-.76)} ${y0}V${y0+width}`}/>
        <path d={`M${x0} ${py(3.05)}H${px(COURT.length/2-1.98)} M${px(COURT.length/2+1.98)} ${py(3.05)}H${x0+len}`}/>
      </g>
      <path d={`M${px(6.7)} ${y0-9}V${y0+width+9}`} stroke="#ffffff" strokeWidth="5" />
      <g opacity=".45" stroke="#ffffff" strokeWidth=".8">{Array.from({length:22},(_,i)=><line key={i} x1={px(6.7)-3} x2={px(6.7)+3} y1={y0+i*width/21} y2={y0+i*width/21}/>)}</g>
      <circle cx={px(a.x+a.w*.64)} cy={py(a.y+a.h/2)} r="13" fill="#e31837" stroke="#ffffff" strokeWidth="3" />
      <circle cx={px(b.x+b.w*.4)} cy={py(b.y+b.h/2)} r="13" fill="#a3e26a" stroke="#ffffff" strokeWidth="3" />
      <path d={`M${px(a.x+a.w*.64)+10} ${py(a.y+a.h/2)} Q390 -5 ${px(b.x+b.w*.4)-10} ${py(b.y+b.h/2)}`} fill="none" stroke="#fff" strokeDasharray="4 8" strokeWidth="2" opacity=".7" />
      <g fill="#d9eee3" fontSize="13" fontFamily="inherit"><text x="390" y="26" textAnchor="middle">LƯỚI</text><text x="90" y="362">Người chơi A</text><text x="586" y="362">Người chơi B</text></g>
    </svg>
  );
}

/** Riêng cho trang /guide. Giữ CourtExplorer SVG nguyên bản trong các bài học chi tiết. */
export function CourtArena3D({ initial = 'serve-doubles', className }: { initial?: CourtMode; className?: string }) {
  const [mode,setMode] = useState<CourtMode>(initial);
  const [score,setScore] = useState(0);
  const [view,setView] = useState<View>('angle');
  // Mặc định theo cài đặt "giảm chuyển động" của hệ thống; người dùng bấm Phát / Tạm dừng thì theo lựa chọn đó.
  const [pausedChoice, setPausedChoice] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const paused = pausedChoice ?? reducedMotion;
  const [show3D,setShow3D] = useState(true);
  const [visible,setVisible] = useState(false);
  const [failed,setFailed] = useState(false);
  const [ready,setReady] = useState(false);
  const intersectionRef = useRef<HTMLDivElement>(null);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => { setFailed(true); setReady(false); }, []);
  const serving = isServeMode(mode);
  const effective3D = show3D && !failed;
  const caption = courtCaption(mode, score);

  useEffect(() => {
    const el = intersectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '220px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className={cn('rga-root', className)} aria-label="Mô phỏng sân cầu lông ba chiều">
      <header className="rga-toolbar">
        <div className="rga-toolbar-heading"><span className="rga-live-dot" /> RALLY / SÂN CẦU LÔNG 3D</div>
        <button type="button" className="rga-switch" disabled={failed} onClick={() => { setReady(false); setShow3D((v) => !v); }} aria-pressed={!effective3D}>
          {effective3D ? <Map size={15} aria-hidden /> : <ScanEye size={15} aria-hidden />}{failed ? 'Chế độ 2D dự phòng' : effective3D ? 'Sơ đồ 2D' : 'Trở lại 3D'}
        </button>
      </header>
      <div className="rga-modes" role="group" aria-label="Chọn chế độ sân">
        {COURT_MODES.map((item) => <button key={item.mode} type="button" className={mode===item.mode?'is-active':''} aria-pressed={mode===item.mode} onClick={() => setMode(item.mode)}>{item.label}</button>)}
      </div>
      <div className="rga-stage" ref={intersectionRef}>
        {effective3D && visible ? <ArenaScene mode={mode} score={score} view={view} paused={paused} onError={onError} onReady={onReady} /> : <PlanB mode={mode} score={score}/>}
        {effective3D && !visible && <div className="rga-loading" aria-live="polite">Sân 3D sẽ tải khi bạn cuộn đến đây</div>}
        {effective3D && visible && !ready && <div className="rga-loading" aria-live="polite">Đang dựng sân 3D…</div>}
        {effective3D && ready && (
          <div className={cn('rga-playback-status', paused && 'is-paused')} role="status" aria-live="polite">
            <span className="rga-playback-dot" aria-hidden="true" />
            {paused ? 'Đã tạm dừng' : 'Đang mô phỏng'}
          </div>
        )}
        {effective3D && ready && paused && (
          <div className="rga-pause-overlay" aria-hidden="true">
            <span className="rga-pause-icon"><Pause size={22} strokeWidth={2.3}/></span>
            <span>Mô phỏng đã tạm dừng</span>
          </div>
        )}
        <div className="rga-stage-meta" aria-hidden="true"><span><i className="rga-player-red"/> NGƯỜI CHƠI A</span><span><i className="rga-player-green"/> NGƯỜI CHƠI B</span></div>
      </div>
      <div className="rga-controls">
        <div className="rga-scene-buttons">
          <button type="button" disabled={!effective3D || !ready} onClick={() => setView((v) => v==='angle'?'top':'angle')}><RotateCcw size={16} aria-hidden/> {view==='angle'?'Nhìn từ trên':'Góc phối cảnh'}</button>
          <button type="button" className={cn('rga-play-toggle', paused && 'is-paused')} disabled={!effective3D || !ready} aria-pressed={paused} aria-label={paused ? 'Tiếp tục phát hoạt cảnh 3D' : 'Tạm dừng hoạt cảnh 3D'} onClick={() => setPausedChoice(!paused)}>{paused?<Play size={16} aria-hidden/>:<Pause size={16} aria-hidden/>}{paused?'Tiếp tục':'Tạm dừng'}</button>
        </div>
        {serving && <div className="rga-score"><span>Điểm bên giao</span><div className="rga-stepper"><button type="button" disabled={score<=0} aria-label="Giảm điểm" onClick={() => setScore((v)=>Math.max(0,v-1))}><Minus size={16} aria-hidden/></button><output aria-live="polite">{score}</output><button type="button" disabled={score>=30} aria-label="Tăng điểm" onClick={() => setScore((v)=>Math.min(30,v+1))}><Plus size={16} aria-hidden/></button></div><strong>Ô {serveSide(score)==='right'?'phải':'trái'}</strong></div>}
      </div>
      <p className="rga-caption" aria-live="polite">{caption}</p>
      <p className="rga-note">Hai nhân vật mô phỏng động tác đánh cầu để minh họa; các vạch sân và ô giao cầu tuân theo chế độ đang chọn. Trên máy tính, kéo chuột để xoay sân 3D.</p>
    </section>
  );
}
