import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { requireSupabaseConfig } from '@/lib/env';

import { type Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/** Client theo phiên đăng nhập (cookie) — mọi truy vấn chịu RLS của người dùng. */
export async function createClient(): Promise<AppSupabaseClient> {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Gọi từ Server Component: không ghi được cookie. Proxy đã làm mới phiên trước đó.
        }
      },
    },
  });
}
