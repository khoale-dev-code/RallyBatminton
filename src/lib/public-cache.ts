import 'server-only';

import { revalidateTag, updateTag } from 'next/cache';

/**
 * Dữ liệu công khai được cache phía máy chủ (giống nhau cho mọi khách, không phụ thuộc đăng nhập).
 * Giờ trống / tồn kho trực tiếp KHÔNG nằm trong cache này.
 */
export const PUBLIC_TAGS = {
  brand: 'public-brand',
  branches: 'public-branches',
  catalog: 'public-catalog',
  legal: 'public-legal',
  booking: 'public-booking-status',
} as const;

export type PublicTag = keyof typeof PUBLIC_TAGS;

/** Thời gian tối đa giữ cache (giây) — sau khi admin sửa, cache được xóa ngay bằng invalidatePublic. */
export const PUBLIC_REVALIDATE = { brand: 600, branches: 300, catalog: 60, legal: 600, booking: 60 } as const;

/** Gọi sau khi admin sửa dữ liệu công khai: lần xem kế tiếp lấy dữ liệu mới ngay (không phục vụ bản cũ). */
export function invalidatePublic(...scopes: PublicTag[]): void {
  for (const scope of scopes) {
    const tag = PUBLIC_TAGS[scope];
    try {
      updateTag(tag);
    } catch {
      // Ngoài Server Action (Route Handler…): hết hạn ngay, lần sau tải lại.
      revalidateTag(tag, { expire: 0 });
    }
  }
}
