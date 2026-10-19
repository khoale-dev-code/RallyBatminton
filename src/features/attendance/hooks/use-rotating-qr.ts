'use client';

import { useEffect, useState } from 'react';

import { issueQrAction } from '../actions';

interface QrState {
  url: string | null;
  expiresAt: string | null;
  error: string | null;
}

/** Xin mã QR mới trước khi mã cũ hết hạn (90 giây) và khi màn hình quay lại. */
export function useRotatingQr(branchId: string, refreshSeconds = 75): QrState {
  const [state, setState] = useState<QrState>({ url: null, expiresAt: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      issueQrAction(branchId).then(
        (res) => {
          if (cancelled) return;
          setState(res.ok ? { url: res.url, expiresAt: res.expiresAt, error: null } : { url: null, expiresAt: null, error: res.error });
        },
        () => {
          if (!cancelled) setState((s) => ({ ...s, error: 'Mất kết nối. Đang thử lại…' }));
        },
      );
    };
    load();
    const id = window.setInterval(load, refreshSeconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [branchId, refreshSeconds]);

  return state;
}
