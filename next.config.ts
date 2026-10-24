import type { NextConfig } from 'next';

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];

/** Cho phép next/image tải ảnh công khai từ Supabase Storage của chính project. */
function supabaseStoragePattern(): { patterns: RemotePattern[]; isLocal: boolean } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { patterns: [], isLocal: false };
  try {
    const url = new URL(raw);
    const protocol = url.protocol === 'http:' ? 'http' : 'https';
    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    return {
      patterns: [{ protocol, hostname: url.hostname, port: url.port, pathname: '/storage/v1/object/public/**' }],
      isLocal,
    };
  } catch {
    return { patterns: [], isLocal: false };
  }
}

const storage = supabaseStoragePattern();

/**
 * Content-Security-Policy: chỉ cho tải mã / kết nối tới đúng các nơi website dùng (Supabase, Cloudflare Turnstile,
 * bản đồ Google nhúng). Next.js cần 'unsafe-inline' cho script khởi tạo trang; 'unsafe-eval' chỉ ở chế độ dev.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== 'production';
  const preview = process.env.VERCEL_ENV === 'preview';
  let supabase = '';
  let supabaseWs = '';
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    supabase = url.origin;
    supabaseWs = `${url.protocol === 'http:' ? 'ws' : 'wss'}://${url.host}`;
  } catch {
    // Chưa cấu hình Supabase: bỏ qua.
  }
  const turnstile = 'https://challenges.cloudflare.com';
  const vercelLive = preview ? ' https://vercel.live' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} ${turnstile}${vercelLive}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} ${turnstile}${vercelLive} ipc: http://ipc.localhost`.replace(/\s+/g, ' ').trim(),
    `frame-src ${turnstile} https://www.google.com https://maps.google.com${vercelLive}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase} https://accounts.google.com`.trim(),
    "frame-ancestors 'none'",
    // Supabase chạy http (máy cục bộ) thì không ép https.
    ...(dev || supabase.startsWith('http:') ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  // Chỉ có tác dụng khi chạy HTTPS (Vercel); trình duyệt bỏ qua trên http://localhost.
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

/**
 * Mã phiên bản của lần build: Rally Manager (ứng dụng cài trên máy quầy) so với máy chủ để biết đã có bản mới.
 * Vercel: mã deployment / commit; máy khác: thời điểm build.
 */
const buildId = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_RALLY_BUILD: buildId },
  images: {
    remotePatterns: storage.patterns,
    // Supabase chạy cục bộ (127.0.0.1) bị next/image chặn theo mặc định → phục vụ ảnh gốc.
    unoptimized: storage.isLocal,
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Số tiến trình build song song (thu thập dữ liệu trang). Mặc định Next dùng (số nhân CPU − 1) — máy nhiều nhân, ít RAM
    // dễ hết bộ nhớ ("Zone Allocation failed"). Giới hạn 4; đổi bằng biến NEXT_BUILD_CPUS.
    cpus: Math.max(1, Number(process.env.NEXT_BUILD_CPUS) || 4),
    // Bộ nhớ đệm phía trình duyệt khi chuyển trang:
    //  - dynamic 0: trang quản trị luôn lấy số liệu mới khi bấm vào (mặc định Next 16);
    //  - static 30: trang tải trước toàn bộ (rê chuột lên menu quản trị) chỉ dùng lại trong 30 giây thay vì 5 phút.
    staleTimes: { dynamic: 0, static: 30 },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Service worker của Rally Manager: luôn kiểm tra bản mới (không lưu đệm file này).
      {
        source: '/rally-sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manager.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
