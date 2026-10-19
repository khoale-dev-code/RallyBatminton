'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'loading' | 'done';

/** Liên kết nội bộ có dẫn sang trang khác không (bỏ qua tab mới, tải file, chỉ đổi #hash…). */
function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!(event.target instanceof Element)) return false;
  const anchor = event.target.closest('a');
  if (!anchor || anchor.hasAttribute('download')) return false;
  const target = anchor.getAttribute('target');
  if (target && target !== '_self') return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Thanh tiến trình mảnh ở đỉnh màn hình: hiện ngay khi bấm liên kết, chạy chậm dần trong lúc
 * máy chủ dựng trang, rồi hoàn tất khi URL đổi. Giúp mọi thao tác có phản hồi tức thì.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const clear = () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;
      clear();
      setPhase('loading');
      // Phòng khi trang không đổi URL (lỗi mạng, chuyển hướng về chính nó) — tự ẩn sau 12 giây.
      timers.current.push(window.setTimeout(() => setPhase('idle'), 12000));
    };
    // Ô lọc / tìm kiếm (form GET) cũng là chuyển trang.
    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      if (form.method.toLowerCase() !== 'get') return;
      const url = new URL(form.action, window.location.href);
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(form, event.submitter)) if (typeof value === 'string') query.append(key, value);
      url.search = query.toString();
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clear();
      setPhase('loading');
      timers.current.push(window.setTimeout(() => setPhase('idle'), 12000));
    };
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('submit', onSubmit, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('submit', onSubmit, { capture: true });
      clear();
    };
  }, []);

  useEffect(() => {
    if (phaseRef.current !== 'loading') return;
    for (const t of timers.current) window.clearTimeout(t);
    setPhase('done');
    timers.current = [window.setTimeout(() => setPhase('idle'), 320)];
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden" data-phase={phase}>
      <div
        className={
          phase === 'idle'
            ? 'h-full origin-left scale-x-0 bg-court opacity-0'
            : phase === 'loading'
              ? 'h-full origin-left scale-x-[0.82] bg-court opacity-100 shadow-[0_0_8px_rgb(98_187_70/0.7)] transition-transform duration-[8000ms] ease-[cubic-bezier(0.08,0.7,0.15,1)]'
              : 'h-full origin-left scale-x-100 bg-court opacity-0 transition-[transform,opacity] duration-300 ease-out'
        }
      />
    </div>
  );
}
