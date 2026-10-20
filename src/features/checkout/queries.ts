import 'server-only';

import { isUuid } from '@/lib/ids';
import { createClient } from '@/lib/supabase/server';

import { extendOptionsSchema, type ExtendOptions } from './lib/extend';

/** Sân còn trống tới mấy giờ + lựa chọn gia hạn kèm tiền (RPC court_extend_options). Chưa chạy SQL 20 → null. */
export async function getExtendOptions(bookingId: string): Promise<ExtendOptions | null> {
  if (!isUuid(bookingId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('court_extend_options', { p_booking_id: bookingId });
  if (error) {
    console.error('[checkout] Không đọc được lựa chọn gia hạn (đã chạy 20_booking_extend.sql?):', error.message);
    return null;
  }
  const parsed = extendOptionsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
