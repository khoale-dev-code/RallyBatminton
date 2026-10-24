'use client';

import { RefreshCw, WifiOff, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { toast } from '@/components/ui/toast';
import { registerPushAction } from '@/features/push/actions';
import { deviceLabel } from '@/features/push/lib/push';
import { getBrowserClient } from '@/lib/supabase/browser';

import { markInstalled, setInstallPrompt, type BeforeInstallPromptEvent } from '../lib/install-store';
import { hasNewVersion, isLivePath, STALE_AFTER_HIDDEN_MS } from '../lib/live';

const CURRENT_BUILD = process.env.NEXT_PUBLIC_RALLY_BUILD;
const VERSION_CHECK_MS = 5 * 60_000;
const OFFLINE_POLL_MS = 10_000;

/** Hỏi máy chủ (không qua bộ nhớ đệm). null = không tới được máy chủ. */
async function pingServer(): Promise<unknown> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Phần chạy nền của Rally Manager trong khung quản trị:
 *  - cài service worker (chỉ lưu tài nguyên tĩnh + trang "mất kết nối", KHÔNG lưu dữ liệu);
 *  - báo mất kết nối, chặn gửi thao tác mới khi mất mạng (không tự gửi lại — tránh thu tiền / đặt sân hai lần);
 *  - có mạng lại / quay lại sau khi để máy lâu → tải dữ liệu mới từ máy chủ;
 *  - lịch sân của chi nhánh đổi (khách đặt online, SePay xác nhận cọc) → làm mới trang vận hành;
 *  - máy chủ có phiên bản mới → mời tải lại.
 */
export function ManagerRuntime({ activeBranchId }: { activeBranchId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const offlineRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // 1. Service worker + sự kiện cài ứng dụng.
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => markInstalled();
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/rally-sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          registrationRef.current = reg;
        })
        .catch(() => {
          // Trình duyệt chặn service worker (chế độ riêng tư…): ứng dụng vẫn chạy bình thường qua mạng.
        });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 2. Kết nối mạng + phiên bản mới.
  useEffect(() => {
    let pollTimer: number | undefined;
    let hiddenAt: number | null = null;

    const checkVersion = async () => {
      const server = await pingServer();
      if (server === null) {
        goOffline();
        return;
      }
      if (hasNewVersion(CURRENT_BUILD, server)) setUpdateReady(true);
      void registrationRef.current?.update().catch(() => undefined);
    };

    const backOnline = () => {
      if (!offlineRef.current) return;
      offlineRef.current = false;
      setOffline(false);
      window.clearInterval(pollTimer);
      pollTimer = undefined;
      router.refresh();
      toast.success('Đã có mạng lại — đã tải dữ liệu mới nhất.');
      void checkVersion();
    };

    const poll = async () => {
      if ((await pingServer()) !== null) backOnline();
    };

    function goOffline() {
      if (offlineRef.current) return;
      offlineRef.current = true;
      setOffline(true);
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => void poll(), OFFLINE_POLL_MS);
    }

    const onOffline = () => goOffline();
    const onOnline = () => void poll();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (offlineRef.current) {
        void poll();
        return;
      }
      if (away > STALE_AFTER_HIDDEN_MS) router.refresh();
      void checkVersion();
    };

    if (!navigator.onLine) goOffline();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    const versionTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !offlineRef.current) void checkVersion();
    }, VERSION_CHECK_MS);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(versionTimer);
      window.clearInterval(pollTimer);
    };
  }, [router]);

  // 3. Mất mạng: chặn gửi form (thu tiền, đặt sân…) ngay từ đầu — không để thao tác treo rồi tự gửi lại sau.
  useEffect(() => {
    if (!offline) return;
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast.error('Đang mất kết nối — thao tác CHƯA được gửi. Thử lại khi có mạng.');
    };
    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, [offline]);

  // 4. Lịch sân của chi nhánh thay đổi → làm mới trang vận hành (sự kiện không chứa dữ liệu cá nhân).
  useEffect(() => {
    if (!activeBranchId) return;
    const supabase = getBrowserClient();
    let timer: number | undefined;
    let pending = false;
    let lastDispatch = 0;
    const refreshSoon = () => {
      // Nhờ máy chủ gửi thông báo đẩy đang chờ (vd. nhân viên khác vừa xác nhận đơn) — tối đa 1 lần / 15 giây.
      if (Date.now() - lastDispatch > 15_000) {
        lastDispatch = Date.now();
        void fetch('/api/push/dispatch', { method: 'POST', cache: 'no-store' }).catch(() => undefined);
      }
      if (!isLivePath(pathRef.current)) return;
      if (document.visibilityState !== 'visible') {
        pending = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 1200);
    };
    const onVisible = () => {
      if (pending && document.visibilityState === 'visible') {
        pending = false;
        refreshSoon();
      }
    };
    const channel = supabase
      .channel(`branch:${activeBranchId}:availability`)
      .on('broadcast', { event: 'availability_changed' }, refreshSoon)
      .subscribe();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [activeBranchId, router]);

  // 5. Thông báo đẩy: thiết bị đã bật → gắn lại với tài khoản đang đăng nhập (mỗi phiên một lần — máy quầy dùng chung),
  //    và điền địa chỉ thiết bị vào nút Đăng xuất để đăng xuất thì ngừng nhận thông báo của tài khoản này.
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    let alive = true;
    void navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => reg?.pushManager.getSubscription())
      .then(async (sub) => {
        if (!alive || !sub) return;
        for (const input of document.querySelectorAll<HTMLInputElement>('input[name="push_endpoint"]')) input.value = sub.endpoint;
        let synced: string | null = null;
        try {
          synced = window.sessionStorage.getItem('rally-push-synced');
        } catch {
          synced = null;
        }
        if (synced === sub.endpoint) return;
        const json = sub.toJSON();
        const res = await registerPushAction({ endpoint: json.endpoint, keys: json.keys, label: deviceLabel(navigator.userAgent) });
        if (res.ok) {
          try {
            window.sessionStorage.setItem('rally-push-synced', sub.endpoint);
          } catch {
            // bỏ qua
          }
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  const reload = () => {
    const waiting = registrationRef.current?.waiting;
    if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  return (
    <>
      {offline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 z-[70] flex items-start justify-center gap-2 bg-shuttle-deep px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-paper shadow-lg"
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Mất kết nối Internet — dữ liệu trên màn hình có thể chưa cập nhật. Thao tác mới chưa gửi được cho tới khi có mạng.</span>
        </div>
      )}
      {updateReady && !updateDismissed && !offline && (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-[70] flex flex-col gap-3 rounded-panel border border-line bg-paper p-4 text-sm shadow-[0_20px_40px_-20px_rgb(0_0_0/0.45)] sm:left-auto sm:w-96"
        >
          <p className="font-medium">Đã có phiên bản mới của Rally Manager</p>
          <p className="text-muted">Lưu xong việc đang làm rồi tải lại để dùng bản mới.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reload}
              className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 font-medium text-paper hover:bg-primary-hover"
            >
              <RefreshCw className="size-4" aria-hidden />
              Tải lại
            </button>
            <button
              type="button"
              onClick={() => setUpdateDismissed(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-4 hover:bg-hall"
            >
              <X className="size-4" aria-hidden />
              Để sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
