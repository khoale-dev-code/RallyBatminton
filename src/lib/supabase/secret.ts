import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseConfig } from '@/lib/env';
import { getSecretKey } from '@/lib/env.server';

import { type Database } from './database.types';
import { type AppSupabaseClient } from './server';

/**
 * Client quyền server (bỏ qua RLS). Chỉ dùng cho:
 *  - RPC dành riêng cho server (giữ sân khách, tra cứu đơn, đăng nhập bằng SĐT)
 *  - Supabase Auth Admin (tạo/khóa tài khoản nhân viên)
 * Không bao giờ import file này từ Client Component ('server-only' sẽ báo lỗi build).
 */
export function createSecretClient(): AppSupabaseClient {
  const { url } = requireSupabaseConfig();
  return createSupabaseClient<Database>(url, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
