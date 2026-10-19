'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, zText, zUuid } from '@/lib/validation';

const zMonth = () => z.string().regex(/^\d{4}-\d{2}-01$/, 'Tháng không hợp lệ');

const adjustmentSchema = z.object({
  employee_id: zUuid('nhân viên'),
  direction: z.enum(['plus', 'minus']),
  amount: z.preprocess(
    (v) => (typeof v === 'string' ? Number(v.replace(/[.\s,₫đ]/g, '')) : v),
    z.number({ error: 'Nhập số tiền' }).int().min(1000, 'Tối thiểu 1.000đ').max(100_000_000),
  ),
  reason: zText('lý do', 3, 250),
});

export async function addAdjustmentAction(month: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  if (!zMonth().safeParse(month).success) return formError('Tháng không hợp lệ.');
  const parsed = adjustmentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('payroll_adjustments').insert({
    employee_id: v.employee_id,
    month,
    amount: v.direction === 'plus' ? v.amount : -v.amount,
    reason: v.reason,
  });
  if (error) return formDbError(error);
  revalidatePath('/admin/payroll');
  return formSuccess(v.direction === 'plus' ? 'Đã thêm khoản thưởng/phụ cấp.' : 'Đã thêm khoản khấu trừ.');
}

/** Điều chỉnh không sửa/xóa — chỉ hủy (giữ dấu vết) rồi tạo khoản mới. */
export async function voidAdjustmentAction(adjustmentId: string, _prev: FormState): Promise<FormState> {
  const ctx = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from('payroll_adjustments')
    .update({ voided_at: new Date().toISOString(), voided_by: ctx.userId })
    .eq('id', adjustmentId)
    .is('voided_at', null);
  if (error) return formDbError(error);
  revalidatePath('/admin/payroll');
  return formSuccess('Đã hủy khoản điều chỉnh.');
}

export async function closePayrollAction(month: string, _prev: FormState): Promise<FormState> {
  await requireOwner();
  if (!zMonth().safeParse(month).success) return formError('Tháng không hợp lệ.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_payroll_month', { p_month: month });
  if (error) return formDbError(error);
  revalidatePath('/admin/payroll');
  revalidatePath('/admin/me');
  return formSuccess('Đã chốt bảng lương. Ca làm, mức lương và điều chỉnh của tháng này đã khóa.');
}
