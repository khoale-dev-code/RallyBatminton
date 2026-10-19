import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseConfig } from '@/lib/env';

import { type Database } from './database.types';
import { type AppSupabaseClient } from './server';

/**
 * Client ẩn danh, KHÔNG đọc cookie → trang công khai có thể cache (ISR).
 * Chỉ thấy dữ liệu mà RLS cho phép vai trò anon.
 */
export function createPublicClient(): AppSupabaseClient {
  const { url, key } = requireSupabaseConfig();
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
