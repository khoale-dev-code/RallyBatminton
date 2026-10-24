import { z } from 'zod';

/** Dịch vụ đẩy chính thức (cùng danh sách với private.push_endpoint_allowed trong 24_push_notifications.sql). */
const ALLOWED_PUSH_HOST =
  /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/i;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && ALLOWED_PUSH_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export const pushTargetSchema = z.object({ id: z.string(), endpoint: z.string(), p256dh: z.string(), auth: z.string() });
export const pushItemSchema = z.object({
  id: z.number(),
  kind: z.enum(['booking_new', 'deposit_paid', 'payment_review', 'security', 'test']),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  tag: z.string().nullable(),
  targets: z.array(pushTargetSchema),
});
export type PushItem = z.infer<typeof pushItemSchema>;

/** Thời gian dịch vụ đẩy giữ thông báo khi thiết bị đang tắt máy (giây). Quá hạn thì bỏ — tin cũ không còn ý nghĩa. */
export function pushTtl(kind: PushItem['kind']): number {
  switch (kind) {
    case 'booking_new':
    case 'deposit_paid':
      return 60 * 60;
    case 'payment_review':
    case 'security':
      return 24 * 60 * 60;
    default:
      return 5 * 60;
  }
}

/** Đơn mới / tiền cọc / cảnh báo cần đến ngay; còn lại bình thường. */
export function pushUrgency(kind: PushItem['kind']): 'high' | 'normal' {
  return kind === 'test' ? 'normal' : 'high';
}

/** Nội dung gửi xuống thiết bị (service worker hiển thị). Chỉ đường dẫn nội bộ của khu quản trị. */
export function pushPayload(item: PushItem): string {
  const url = item.url.startsWith('/admin') ? item.url : '/admin';
  return JSON.stringify({ title: item.title, body: item.body, url, tag: item.tag ?? `rally-${item.id}` });
}

export const PUSH_PREF_FIELDS = [
  { key: 'booking_new', label: 'Đơn đặt sân online mới', hint: 'Khách vừa giữ sân trên website (chờ chuyển cọc).', ownerOnly: false },
  { key: 'deposit_paid', label: 'Đã nhận cọc', hint: 'SePay báo tiền về, đơn tự xác nhận.', ownerOnly: false },
  { key: 'payment_review', label: 'Giao dịch cần xử lý', hint: 'Chuyển sau khi hết hạn, sai nội dung, chuyển dư…', ownerOnly: false },
  { key: 'security', label: 'Cảnh báo bảo mật', hint: 'Giữ sân ảo, dò mật khẩu, webhook giả, gỡ 2 lớp.', ownerOnly: true },
] as const;
export type PushPrefKey = (typeof PUSH_PREF_FIELDS)[number]['key'];
export type PushPrefs = Record<PushPrefKey, boolean>;

/** "aBc-_" (base64url) → Uint8Array cho pushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Tên thiết bị gợi nhớ: "Chrome · Windows". */
export function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Trình duyệt';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Thiết bị';
  return `${browser} · ${os}`;
}
