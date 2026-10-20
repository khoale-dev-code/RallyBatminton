'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Tải lại dữ liệu trang định kỳ khi tab đang mở (vd. lịch ca "đang diễn ra" tự cập nhật). */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, intervalMs]);
  return null;
}
