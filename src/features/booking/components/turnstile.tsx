'use client';

import { useEffect, useEffectEvent, useRef } from 'react';

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  theme: 'light' | 'dark' | 'auto';
  action?: string;
  language: string;
  appearance: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileApi {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile_load_failed'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Đổi giá trị để yêu cầu xác minh lại (sau khi gửi thất bại). */
  resetSignal: number;
  /** Tên thao tác (a-z, 0-9, _ -). Máy chủ kiểm tra lại → mã xác minh của form này không dùng được cho form khác. */
  action?: string;
}

/** Cloudflare Turnstile — chống bot cho form giữ sân. */
export function Turnstile({ siteKey, onToken, resetSignal, action }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const emit = useEffectEvent((token: string | null) => onToken(token));

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => emit(token),
          'expired-callback': () => emit(null),
          'error-callback': () => emit(null),
          theme: 'light',
          language: 'vi',
          appearance: 'always',
          ...(action ? { action } : {}),
        });
      })
      .catch(() => emit(null));
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetSignal > 0 && widgetRef.current && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
      emit(null);
    }
  }, [resetSignal]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
