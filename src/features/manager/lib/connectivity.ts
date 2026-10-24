import { useSyncExternalStore } from 'react';

/**
 * Trạng thái kết nối dùng chung cho cả khu quản trị (ManagerRuntime cập nhật: sự kiện online/offline của trình duyệt
 * + hỏi máy chủ). Quầy bán dựa vào đây để chuyển sang chế độ bán khi mất mạng.
 */
let offline = false;
const listeners = new Set<() => void>();

export function setOffline(value: boolean) {
  if (offline === value) return;
  offline = value;
  for (const l of listeners) l();
}

/** Đang mất mạng (theo máy chủ hoặc trình duyệt). */
export function isOfflineNow(): boolean {
  return offline || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, isOfflineNow, () => false);
}
