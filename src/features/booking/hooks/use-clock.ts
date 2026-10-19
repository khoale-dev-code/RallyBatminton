'use client';

import { useSyncExternalStore } from 'react';

import { todayKey } from '@/lib/time';

function subscribeMinute(callback: () => void) {
  const id = window.setInterval(callback, 30_000);
  return () => window.clearInterval(id);
}

/** Phút hiện tại (epoch / 60000) — null khi render trên server để tránh lệch hydration. */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60000),
    () => null,
  );
}

/** Ngày hôm nay theo múi giờ chi nhánh (chỉ có ở trình duyệt). */
export function useToday(tz: string): string | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => todayKey(tz),
    () => null,
  );
}
