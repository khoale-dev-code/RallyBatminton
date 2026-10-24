import { type z } from 'zod';

import { toDesktopError, type DesktopCommand, type DesktopError } from './lib/desktop';

/** Cầu nối Tauri gắn vào trang khi chạy trong Rally Manager cho Windows (không có trên trình duyệt thường). */
interface TauriInternals {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export type DesktopResult<T> = { ok: true; data: T } | { ok: false; error: DesktopError };

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function';
}

/** Gọi lệnh máy quầy; kết quả được kiểm tra bằng schema (không tin dữ liệu trả về). */
export async function callDesktop<T>(cmd: DesktopCommand, schema: z.ZodType<T>, args?: Record<string, unknown>): Promise<DesktopResult<T>> {
  const bridge = typeof window === 'undefined' ? undefined : window.__TAURI_INTERNALS__;
  if (!bridge) return { ok: false, error: { code: 'NOT_DESKTOP', message: 'Không chạy trong Rally Manager cho Windows.' } };
  try {
    const raw = await bridge.invoke(cmd, args);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: { code: 'DESKTOP_FAILED', message: 'Phản hồi của ứng dụng không hợp lệ.' } };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: toDesktopError(err) };
  }
}
