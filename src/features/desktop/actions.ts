'use server';

import { z } from 'zod';

import { getActiveBranch, getStaffContext } from '@/lib/auth/context';
import { toUserMessage } from '@/lib/errors';
import { CASH_DRAWER_TRIGGERS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

const drawerLogSchema = z.object({
  trigger: z.enum(CASH_DRAWER_TRIGGERS),
  refCode: z.string().trim().max(40).optional(),
  device: z.string().trim().max(120).optional(),
});

export type DrawerLogResult = { ok: true } | { ok: false; error: string };

/** Ghi nhật ký mở ngăn kéo tiền ở chi nhánh đang làm việc (database kiểm quyền). Mở tay: ghi được mới mở. */
export async function logCashDrawerAction(input: unknown): Promise<DrawerLogResult> {
  const parsed = drawerLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dữ liệu mở ngăn kéo không hợp lệ.' };
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' };
  const branch = await getActiveBranch(ctx);
  if (!branch) return { ok: false, error: 'Tài khoản chưa được giao chi nhánh nào.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('log_cash_drawer_open', {
    p_branch_id: branch.branchId,
    p_trigger: parsed.data.trigger,
    p_ref_code: parsed.data.refCode || null,
    p_device: parsed.data.device || null,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  return { ok: true };
}
