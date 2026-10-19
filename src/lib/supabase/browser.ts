'use client';

import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseConfig } from '@/lib/env';

import { type Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

/** Client trình duyệt (dùng chung một instance): lịch trống realtime, tải ảnh lên Storage. */
export function getBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, key } = requireSupabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
