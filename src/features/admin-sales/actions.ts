'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, zText } from '@/lib/validation';

/** Hủy đơn bán (chỉ chủ sân): hoàn kho + hủy thanh toán, đơn vẫn lưu với trạng thái "Đã hủy". */
export async function voidSaleAction(saleId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z.object({ reason: zText('lý do hủy', 3, 300) }).safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: parsed.data.reason });
  if (error) return formDbError(error);
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath('/admin/sales');
  revalidatePath('/admin/inventory');
  return formSuccess('Đã hủy đơn và hoàn hàng về kho.');
}
