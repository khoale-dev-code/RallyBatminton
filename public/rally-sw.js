/* Rally Manager — service worker.
 *
 * NGUYÊN TẮC: KHÔNG lưu trang hay dữ liệu nghiệp vụ (lịch sân, khách hàng, doanh thu, phản hồi API / Server Action).
 * Chỉ lưu:
 *   - tài nguyên tĩnh có mã băm trong tên (/_next/static/…) → mở ứng dụng nhanh hơn;
 *   - trang "Mất kết nối" (/offline.html) → hiện khi mở ứng dụng lúc không có mạng.
 * Mọi trang luôn tải trực tiếp từ máy chủ (dữ liệu mới nhất, đúng quyền của người đang đăng nhập).
 */
const VERSION = 'rally-manager-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';
const SHELL = [OFFLINE_URL, '/icons/manager-192.png', '/manager.webmanifest'];
const STATIC_MAX = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  // Đăng xuất trên máy dùng chung: xóa mọi bộ nhớ đệm (kể cả tài nguyên tĩnh) cho chắc chắn.
  if (type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

// Chỉ file trong /_next/static/ (tên có mã băm theo nội dung, kể cả font) — đổi nội dung là đổi tên, không lo bản cũ.
function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

async function trimStatic(cache) {
  const keys = await cache.keys();
  if (keys.length <= STATIC_MAX) return;
  await Promise.all(keys.slice(0, keys.length - STATIC_MAX).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // Server Action, đăng nhập, thanh toán… luôn đi thẳng tới máy chủ.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Turnstile, bản đồ: không can thiệp.

  // Mở trang: luôn lấy từ mạng; chỉ khi mất mạng mới hiện trang báo (không bao giờ hiện bản cũ của trang).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503 })),
    );
    return;
  }

  // Trang "mất kết nối" + biểu tượng: lấy từ mạng, mất mạng thì dùng bản đã lưu lúc cài.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(url.pathname)) || Response.error()));
    return;
  }

  // Tài nguyên tĩnh có mã băm: không đổi nội dung → dùng bản đã lưu, thiếu thì tải và lưu.
  if (isStaticAsset(url) && !url.search) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          await cache.put(req, res.clone());
          event.waitUntil(trimStatic(cache));
        }
        return res;
      }),
    );
  }
  // Còn lại (dữ liệu trang RSC, API, ảnh động…): để trình duyệt xử lý bình thường, không lưu.
});

// ---- Thông báo đẩy (24_push_notifications.sql) ---------------------------------------------------------
// Nội dung do máy chủ Rally gửi qua dịch vụ đẩy chính thức; không chứa tên / số điện thoại khách.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Rally Manager';
  const url = typeof data.url === 'string' && data.url.startsWith('/admin') ? data.url : '/admin';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icons/manager-192.png',
      badge: '/icons/manager-96.png',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      renotify: Boolean(data.tag),
      lang: 'vi',
      data: { url },
    }),
  );
});

// Bấm thông báo: dùng lại cửa sổ Rally Manager đang mở (nếu có), không thì mở cửa sổ mới.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data && typeof event.notification.data.url === 'string' ? event.notification.data.url : '/admin';
  const target = new URL(path.startsWith('/admin') ? path : '/admin', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).pathname.startsWith('/admin'));
      if (existing) {
        await existing.focus();
        return existing.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
