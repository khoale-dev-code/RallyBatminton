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

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: storage.patterns,
    // Supabase chạy cục bộ (127.0.0.1) bị next/image chặn theo mặc định → phục vụ ảnh gốc.
    unoptimized: storage.isLocal,
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Bộ nhớ đệm phía trình duyệt khi chuyển trang:
    //  - dynamic 0: trang quản trị luôn lấy số liệu mới khi bấm vào (mặc định Next 16);
    //  - static 30: trang tải trước toàn bộ (rê chuột lên menu quản trị) chỉ dùng lại trong 30 giây thay vì 5 phút.
    staleTimes: { dynamic: 0, static: 30 },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
