'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 15_000;

function subscribe(callback: () => void) {
  const id = window.setInterval(callback, TICK_MS);
  return () => window.clearInterval(id);
}

function snapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

/**
 * Thời điểm hiện tại, cập nhật mỗi 15 giây. Khi render trên server và lúc hydrate dùng `serverNow`
 * (thời điểm trang được tạo) để HTML khớp nhau; sau đó đồng hồ chạy theo trình duyệt.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, snapshot, () => serverNow);
}
