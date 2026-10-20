import 'server-only';

import { createHash } from 'node:crypto';

import { type StaffContext } from './permissions';

/**
 * Bộ nhớ đệm quyền nhân sự trong bộ nhớ máy chủ, KHÓA THEO MÃ BĂM CỦA CHÍNH ACCESS TOKEN.
 *
 * Mỗi lần mở trang quản trị trước đây phải hỏi database `my_staff_context` (1 lượt mạng) trước khi biết
 * chạy truy vấn nào → nhiều trang tốn 2 lượt. Giữ kết quả 60 giây theo token giúp các lần chuyển trang sau chỉ
 * còn 1 lượt.
 *
 * An toàn:
 *  - Chỉ lưu sau khi database đã xác minh token (RPC chạy thành công bằng đúng token đó). Token giả / sửa đổi
 *    có mã băm khác → không trúng bộ nhớ đệm → lại phải qua database.
 *  - Đây chỉ là thông tin hiển thị / điều hướng. Mọi truy vấn dữ liệu vẫn gửi kèm JWT và RLS kiểm tra lại.
 *  - Hết hạn sau 60 giây hoặc khi token hết hạn (lấy mốc sớm hơn); đổi quyền / chi nhánh / mật khẩu thì xóa ngay.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

type Entry = { ctx: StaffContext; expiresAt: number };

const entries = new Map<string, Entry>();

export function tokenCacheKey(accessToken: string): string {
  return createHash('sha256').update(accessToken).digest('base64url');
}

export function readCachedContext(key: string, now: number = Date.now()): StaffContext | null {
  const hit = entries.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    entries.delete(key);
    return null;
  }
  return hit.ctx;
}

/** `tokenExpiresAt`: thời điểm token hết hạn (ms). */
export function writeCachedContext(key: string, ctx: StaffContext, tokenExpiresAt: number, now: number = Date.now()): void {
  const expiresAt = Math.min(now + TTL_MS, tokenExpiresAt);
  if (expiresAt <= now) return;
  entries.delete(key);
  entries.set(key, { ctx, expiresAt });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

/** Gọi sau khi đổi nhân viên / quyền / chi nhánh / mật khẩu để lần mở trang kế tiếp đọc lại từ database. */
export function clearStaffContextCache(): void {
  entries.clear();
}
