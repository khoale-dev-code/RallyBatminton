'use client';

import { Bell, BellOff, BellRing, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@/components/ui/toast';
import { isDesktopApp } from '@/features/desktop/bridge';
import { isIos, isStandalone } from '@/features/manager/lib/live';
import { publicEnv } from '@/lib/env';

import { registerPushAction, sendTestPushAction, unregisterPushAction } from '../actions';
import { deviceLabel, urlBase64ToUint8Array } from '../lib/push';

type State =
  | { kind: 'loading' }
  | { kind: 'unsupported'; reason: 'browser' | 'ios-not-installed' | 'no-sw' | 'desktop' }
  | { kind: 'not-configured' }
  | { kind: 'denied' }
  | { kind: 'off' }
  | { kind: 'on'; endpoint: string };

async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

/** Bật / tắt thông báo đẩy trên thiết bị đang dùng. */
export function PushPanel() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async (): Promise<State> => {
    // Ứng dụng Windows (WebView2) không có dịch vụ thông báo đẩy của trình duyệt.
    if (isDesktopApp()) return { kind: 'unsupported', reason: 'desktop' };
    if (!('Notification' in window) || !('PushManager' in window)) {
      return { kind: 'unsupported', reason: isIos(navigator.userAgent) && !isStandalone() ? 'ios-not-installed' : 'browser' };
    }
    if (!publicEnv.vapidPublicKey) return { kind: 'not-configured' };
    if (Notification.permission === 'denied') return { kind: 'denied' };
    const reg = await currentRegistration();
    if (!reg) return { kind: 'unsupported', reason: 'no-sw' };
    const sub = await reg.pushManager.getSubscription();
    return sub ? { kind: 'on', endpoint: sub.endpoint } : { kind: 'off' };
  }, []);

  useEffect(() => {
    let alive = true;
    void detect().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [detect]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? { kind: 'denied' } : { kind: 'off' });
        return;
      }
      const reg = await currentRegistration();
      if (!reg) {
        setState({ kind: 'unsupported', reason: 'no-sw' });
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey) }));
      const json = sub.toJSON();
      const res = await registerPushAction({ endpoint: json.endpoint, keys: json.keys, label: deviceLabel(navigator.userAgent) });
      if (!res.ok) {
        await sub.unsubscribe();
        toast.error(res.error);
        return;
      }
      try {
        window.sessionStorage.setItem('rally-push-synced', sub.endpoint);
      } catch {
        // bỏ qua
      }
      setState({ kind: 'on', endpoint: sub.endpoint });
      toast.success('Đã bật thông báo trên thiết bị này.');
      router.refresh();
    } catch {
      toast.error('Không bật được thông báo. Thử lại, hoặc kiểm tra trình duyệt cho phép thông báo.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (state.kind !== 'on') return;
    setBusy(true);
    try {
      await unregisterPushAction(state.endpoint);
      const sub = await (await currentRegistration())?.pushManager.getSubscription();
      await sub?.unsubscribe();
      setState({ kind: 'off' });
      toast.success('Đã tắt thông báo trên thiết bị này.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    const res = await sendTestPushAction();
    setBusy(false);
    if (res.status === 'success') toast.success(res.message ?? 'Đã gửi thử.');
    else toast.error(res.message ?? 'Không gửi được.');
  };

  const btn =
    'inline-flex min-h-11 items-center gap-2 rounded-control px-4 font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2';

  switch (state.kind) {
    case 'loading':
      return <p className="text-sm text-muted">Đang kiểm tra thiết bị…</p>;
    case 'unsupported':
      return (
        <p className="flex items-start gap-2 text-sm text-muted">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.reason === 'desktop'
            ? 'Ứng dụng Windows chưa nhận thông báo đẩy. Bật thông báo trên Chrome / Edge của máy này (mở trang quản trị bằng trình duyệt) hoặc trên điện thoại.'
            : state.reason === 'ios-not-installed'
              ? 'Trên iPhone / iPad (iOS 16.4 trở lên): cài Rally Manager vào màn hình chính ở mục trên, mở từ biểu tượng đó rồi quay lại đây để bật thông báo.'
              : state.reason === 'no-sw'
                ? 'Mở trang này trên bản đã triển khai (Vercel hoặc npm run build + start) để bật thông báo — bản chạy thử npm run dev không hỗ trợ.'
                : 'Trình duyệt này không hỗ trợ thông báo đẩy. Dùng Chrome, Edge, Firefox hoặc Safari bản mới.'}
        </p>
      );
    case 'not-configured':
      return (
        <p className="flex items-start gap-2 text-sm text-muted">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Máy chủ chưa có khóa thông báo. Chủ sân chạy <code>npm run push:keys</code> rồi thêm 3 biến vào Vercel (docs/HUONG-DAN-KY-THUAT.md
          mục 25).
        </p>
      );
    case 'denied':
      return (
        <p className="flex items-start gap-2 text-sm text-shuttle-deep">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Trình duyệt đang chặn thông báo của trang này. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → Thông báo → Cho phép, rồi tải lại trang.
        </p>
      );
    case 'off':
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className={`${btn} bg-primary text-paper hover:bg-primary-hover`}
        >
          <Bell className="size-4" aria-hidden />
          {busy ? 'Đang bật…' : 'Bật thông báo trên thiết bị này'}
        </button>
      );
    case 'on':
      return (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-court-deep">
            <BellRing className="size-4 shrink-0" aria-hidden />
            Thiết bị này đang nhận thông báo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void test()} className={`${btn} border border-line hover:bg-hall`}>
              <Send className="size-4" aria-hidden />
              Gửi thử
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disable()}
              className={`${btn} border border-line text-shuttle-deep hover:bg-shuttle-soft`}
            >
              <BellOff className="size-4" aria-hidden />
              Tắt trên thiết bị này
            </button>
          </div>
        </div>
      );
  }
}
