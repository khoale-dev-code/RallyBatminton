import 'server-only';

import { createClient } from '@/lib/supabase/server';

export const AUDIT_TABLES: Record<string, string> = {
  bookings: 'Đặt sân',
  payments: 'Thanh toán',
  customers: 'Khách hàng',
  branches: 'Chi nhánh',
  courts: 'Sân',
  price_rules: 'Bảng giá',
  products: 'Sản phẩm',
  product_variants: 'Biến thể',
  rental_rates: 'Giá thuê',
  inventory_levels: 'Cài đặt tồn kho',
  sales: 'Đơn bán',
  rentals: 'Cho thuê',
  shifts: 'Ca làm',
  employees: 'Nhân viên',
  employee_pay_rates: 'Mức lương',
  staff_accounts: 'Tài khoản',
  staff_branch_permissions: 'Phân quyền',
  payroll_adjustments: 'Điều chỉnh lương',
};

export const PAGE_SIZE = 50;

export async function listAuditEvents(opts: { table?: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from('audit_events')
    .select('id, occurred_at, actor_id, actor_role, branch_id, table_name, record_id, action, reason, old_data, new_data', {
      count: 'estimated',
    })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(opts.page * PAGE_SIZE, opts.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (opts.table && opts.table in AUDIT_TABLES) query = query.eq('table_name', opts.table);
  const { data, error, count } = await query;
  if (error) throw error;
  const events = data ?? [];
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter((id): id is string => id !== null))];
  const { data: actors } = actorIds.length
    ? await supabase.from('staff_accounts').select('user_id, display_name').in('user_id', actorIds)
    : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.user_id, a.display_name]));
  return {
    events: events.map((e) => ({ ...e, actorName: e.actor_id ? (names.get(e.actor_id) ?? 'Tài khoản đã xóa') : 'Hệ thống' })),
    count: count ?? events.length,
  };
}

/** Các trường thay đổi giữa bản cũ và mới (bỏ qua updated_at). */
export function changedFields(oldData: unknown, newData: unknown): string[] {
  if (!isRecord(oldData) || !isRecord(newData)) return [];
  return Object.keys(newData).filter((k) => k !== 'updated_at' && JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
