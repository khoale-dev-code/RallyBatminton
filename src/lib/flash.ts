import 'server-only';

import { cookies } from 'next/headers';

import { FLASH_COOKIE, type FlashTone } from './flash-cookie';

/**
 * Lời nhắn hiện một lần ở trang kế tiếp (dùng trước redirect() trong Server Action — kết quả trả về
 * bị bỏ khi chuyển trang). Trình duyệt đọc và xóa cookie ngay khi hiện thông báo.
 */
export async function setFlash(message: string, tone: FlashTone = 'success'): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ m: message.slice(0, 200), t: tone })), {
    path: '/',
    maxAge: 60,
    sameSite: 'lax',
    httpOnly: false,
  });
}
