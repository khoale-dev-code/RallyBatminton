import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Phiên bản đang chạy trên máy chủ. Rally Manager so với phiên bản của chính nó để báo "Có bản mới — Tải lại",
 * và gọi tới đây để kiểm tra đã có mạng lại chưa. Không chứa dữ liệu nào khác.
 */
export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_RALLY_BUILD ?? 'unknown' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export function HEAD() {
  return new NextResponse(null, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
