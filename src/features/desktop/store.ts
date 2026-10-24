import { useSyncExternalStore } from 'react';

import { callDesktop, isDesktopApp } from './bridge';
import { desktopInfoSchema, printerSettingsSchema, type DesktopInfo, type PrinterSettings } from './lib/desktop';

/** Trạng thái máy quầy (đọc một lần mỗi lần mở trang, dùng chung cho mọi nút In / Mở ngăn kéo). */
export type DesktopState =
  | { status: 'checking' }
  | { status: 'browser' }
  | { status: 'desktop'; info: DesktopInfo | null; settings: PrinterSettings | null };

let state: DesktopState = { status: 'checking' };
const listeners = new Set<() => void>();

function set(next: DesktopState) {
  state = next;
  for (const l of listeners) l();
}

let loading: Promise<void> | null = null;

/** Đọc trạng thái máy quầy (một lần); luôn trả về trạng thái MỚI NHẤT (kể cả sau khi lưu cài đặt máy in). */
export async function loadDesktopState(): Promise<DesktopState> {
  loading ??= (async () => {
    if (!isDesktopApp()) {
      set({ status: 'browser' });
      return;
    }
    const [info, settings] = await Promise.all([
      callDesktop('desktop_info', desktopInfoSchema),
      callDesktop('get_printer_settings', printerSettingsSchema),
    ]);
    set({ status: 'desktop', info: info.ok ? info.data : null, settings: settings.ok ? settings.data : null });
  })();
  await loading;
  return state;
}

export function setDesktopSettings(settings: PrinterSettings) {
  if (state.status === 'desktop') set({ ...state, settings });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (state.status === 'checking') void loadDesktopState();
  return () => listeners.delete(listener);
}

const serverSnapshot: DesktopState = { status: 'checking' };

export function useDesktopState(): DesktopState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );
}
