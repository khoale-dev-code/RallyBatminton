'use client';

import { useEffect, useState } from 'react';

/** Số giây còn lại tới mốc thời gian; chỉ component dùng hook này re-render mỗi giây. */
export function useCountdown(target: string | Date | null): number {
  const targetMs = target ? new Date(target).getTime() : 0;
  const [remaining, setRemaining] = useState(() => (targetMs ? Math.max(0, Math.round((targetMs - Date.now()) / 1000)) : 0));

  useEffect(() => {
    if (!targetMs) return;
    const tick = () => setRemaining(Math.max(0, Math.round((targetMs - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return remaining;
}
