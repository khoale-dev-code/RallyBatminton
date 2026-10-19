import 'server-only';

import { cookies } from 'next/headers';

/**
 * Có cookie phiên Supabase hay không (không xác minh — chỉ để bỏ qua truy vấn thừa khi chắc chắn là khách).
 * Quyền thật luôn do database kiểm tra (PostgREST xác minh JWT, RLS / hàm SECURITY DEFINER).
 */
export async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}
