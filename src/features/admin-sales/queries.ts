import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays, DEFAULT_TZ, zonedToUtc } from '@/lib/time';

export async function listSalesForDay(branchId: string, dateKey: string, tz: string = DEFAULT_TZ) {
  const supabase = await createClient();
  const from = zonedToUtc(dateKey, '00:00', tz).toISOString();
  const to = zonedToUtc(addDays(dateKey, 1), '00:00', tz).toISOString();
  const { data, error } = await supabase
    .from('sales')
    .select('id, code, status, total_amount, sold_at, customers(full_name, phone), sale_lines(quantity), payments(method, status)')
    .eq('branch_id', branchId)
    .gte('sold_at', from)
    .lt('sold_at', to)
    .order('sold_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const sales = data ?? [];
  // Đơn chờ khách chuyển khoản chưa tính vào doanh thu cho tới khi tiền về.
  const completed = sales.filter((s) => s.status === 'completed' && !s.payments.some((p) => p.status === 'pending'));
  return {
    sales,
    revenue: completed.reduce((n, s) => n + (s.total_amount ?? 0), 0),
    count: completed.length,
  };
}

export async function getSale(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales')
    .select(
      '*, branches(name, timezone), customers(id, full_name, phone), sale_lines(id, product_name, variant_label, quantity, unit_price, line_total, tax_method, vat_rate, vat_amount, pit_rate, pit_amount, unit_name, unit_conversion), payments(id, method, amount, status, reference, created_at)',
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}
