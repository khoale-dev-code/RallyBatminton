import 'server-only';

import { createHash } from 'node:crypto';

import { headers } from 'next/headers';

/**
 * Thông tin kỹ thuật đi kèm bằng chứng đồng ý / yêu cầu: mã băm IP (không lưu IP thật) và trình duyệt (cắt 300 ký tự).
 * Mã băm vẫn là dữ liệu giả danh (có thể liên kết lại nếu biết IP) — được bảo vệ và xóa theo thời hạn lưu trữ.
 */
export async function requestMeta(purpose: string): Promise<{ ipHash: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = h.get('user-agent');
  return {
    ipHash: ip ? createHash('sha256').update(`rally-${purpose}:${ip}`).digest('hex').slice(0, 40) : null,
    userAgent: ua ? ua.slice(0, 300) : null,
  };
}
