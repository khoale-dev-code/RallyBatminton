'use client';

import { useCallback, useSyncExternalStore } from 'react';

function subscribeSecond(callback: () => void) {
  const id = window.setInterval(callback, 1000);
  return () => window.clearInterval(id);
}

/**
 * Số giây còn lại tới mốc thời gian. Khi máy chủ dựng HTML (và lúc trình duyệt "hydrate") trả null —
 * tránh lệch nội dung do đồng hồ máy chủ và máy khách khác nhau vài giây.
 */
export function useCountdown(target: string | Date | null): number | null {
  const targetMs = target ? new Date(target).getTime() : 0;
  const read = useCallback(() => (targetMs ? Math.max(0, Math.round((targetMs - Date.now()) / 1000)) : 0), [targetMs]);
  return useSyncExternalStore(subscribeSecond, read, () => null);
}
