'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { FLASH_COOKIE, type FlashTone } from '@/lib/flash-cookie';

export type ToastTone = FlashTone;

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}


const DURATION: Record<ToastTone, number> = { success: 3500, info: 4500, error: 7000 };
const MAX_VISIBLE = 4;

// Kho thông báo dùng chung (ngoài React) — gọi toast.success(...) ở bất kỳ đâu phía trình duyệt.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const l of listeners) l();
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(tone: ToastTone, message: string) {
  const text = message.trim();
  if (!text) return;
  // Cùng nội dung đang hiện → không chồng thêm bản nữa.
  if (items.some((t) => t.message === text && t.tone === tone)) return;
  const id = nextId++;
  items = [...items, { id, tone, message: text }].slice(-MAX_VISIBLE);
  emit();
  window.setTimeout(() => dismiss(id), DURATION[tone]);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const ToastEnabledContext = createContext(false);

/** Trong khung này, form (ActionForm) báo kết quả bằng thông báo nổi thay vì dòng chữ trong form. */
export function useToastEnabled(): boolean {
  return useContext(ToastEnabledContext);
}

function readFlash(): { tone: ToastTone; message: string } | null {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${FLASH_COOKIE}=`))
    ?.slice(FLASH_COOKIE.length + 1);
  if (!raw) return null;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/`;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value === 'object' && value !== null && 'm' in value && typeof value.m === 'string') {
      const tone = 't' in value && (value.t === 'error' || value.t === 'info') ? value.t : 'success';
      return { tone, message: value.m };
    }
  } catch {
    // Cookie hỏng: bỏ qua.
  }
  return null;
}

const ICON: Record<ToastTone, ReactNode> = {
  success: <CircleCheck className="size-5 shrink-0 text-court" aria-hidden />,
  error: <CircleAlert className="size-5 shrink-0 text-shuttle" aria-hidden />,
  info: <Info className="size-5 shrink-0 text-paper/80" aria-hidden />,
};

/** Vùng hiển thị thông báo nổi (snackbar) + bật chế độ thông báo nổi cho các form bên trong. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  const pathname = usePathname();

  // Lời nhắn để lại trước khi chuyển trang (ví dụ "Đã tạo đơn") → hiện ở trang mới.
  useEffect(() => {
    const flash = readFlash();
    if (flash) push(flash.tone, flash.message);
  }, [pathname]);

  return (
    <ToastEnabledContext.Provider value={true}>
      {children}
      <section
        aria-label="Thông báo"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end sm:px-0 sm:pb-0"
      >
        <ol className="flex w-full max-w-sm flex-col gap-2">
          {list.map((t) => (
            <li
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'animate-fade pointer-events-auto flex items-start gap-3 rounded-control bg-ink px-4 py-3 text-sm text-paper shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)]',
                t.tone === 'error' && 'ring-1 ring-shuttle/60',
              )}
            >
              {ICON[t.tone]}
              <span className="min-w-0 flex-1 leading-snug break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-paper/70 hover:bg-paper/10 hover:text-paper"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </ToastEnabledContext.Provider>
  );
}

/** Báo kết quả một useActionState tự viết (không dùng ActionForm) bằng thông báo nổi. */
export function useActionToast(state: { status: 'idle' | 'success' | 'error'; message?: string }) {
  useEffect(() => {
    if (!state.message) return;
    if (state.status === 'success') toast.success(state.message);
    else if (state.status === 'error') toast.error(state.message);
  }, [state]);
}
