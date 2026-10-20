'use client';

import { useEffect, useState } from 'react';

import { issueQrAction, kioskIssueQrAction } from '../actions';

interface QrState {
  url: string | null;
  expiresAt: string | null;
  error: string | null;
  branchName: string | null;
}

/** Nguồn mã: chủ sân đăng nhập (theo chi nhánh) hoặc máy quầy (theo khóa thiết bị, không đăng nhập). */
export type QrSource = { kind: 'owner'; branchId: string } | { kind: 'kiosk'; deviceToken: string };

/** Xin mã mới trước khi mã cũ hết hạn ~10 giây (thời gian sống theo cài đặt) và khi màn hình quay lại. */
export function useRotatingQr(source: QrSource): QrState {
  const [state, setState] = useState<QrState>({ url: null, expiresAt: null, error: null, branchName: null });
  const key = source.kind === 'owner' ? `o:${source.branchId}` : `k:${source.deviceToken}`;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, Math.max(5_000, ms));
    };
    function load() {
      const request =
        source.kind === 'owner'
          ? issueQrAction(source.branchId).then((r) => (r.ok ? { ...r, branchName: null } : r))
          : kioskIssueQrAction(source.deviceToken);
      request.then(
        (res) => {
          if (cancelled) return;
          if (res.ok) {
            setState({ url: res.url, expiresAt: res.expiresAt, error: null, branchName: res.branchName });
            schedule(new Date(res.expiresAt).getTime() - Date.now() - 10_000);
          } else {
            setState((s) => ({ ...s, url: null, expiresAt: null, error: res.error }));
            schedule(30_000);
          }
        },
        () => {
          if (cancelled) return;
          setState((s) => ({ ...s, error: 'Mất kết nối. Đang thử lại…' }));
          schedule(10_000);
        },
      );
    }
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` đại diện cho source
  }, [key]);

  return state;
}
