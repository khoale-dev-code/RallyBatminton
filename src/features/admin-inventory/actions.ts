'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { invalidatePublic } from '@/lib/public-cache';
import { requireBranchPermission } from '@/lib/auth/guards';
import { formDbError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, zInt, zOptionalText, zUuid } from '@/lib/validation';

const MANUAL_REASONS = ['opening', 'purchase', 'adjustment', 'damage', 'loss'] as const;

const adjustSchema = z
  .object({
    reason: z.enum(MANUAL_REASONS, { error: 'Chọn lý do' }),
    direction: z.enum(['in', 'out']),
    quantity: zInt('Số lượng', 1, 100000),
    note: zOptionalText(300),
  })
  .superRefine((v, ctx) => {
    if ((v.reason === 'opening' || v.reason === 'purchase') && v.direction === 'out') {
      ctx.addIssue({ code: 'custom', path: ['direction'], message: 'Nhập hàng/tồn đầu chỉ được cộng kho' });
    }
    if ((v.reason === 'damage' || v.reason === 'loss') && v.direction === 'in') {
      ctx.addIssue({ code: 'custom', path: ['direction'], message: 'Hư hỏng/mất chỉ được trừ kho' });
    }
    if (['adjustment', 'damage', 'loss'].includes(v.reason) && (v.note?.length ?? 0) < 3) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Ghi rõ lý do (tối thiểu 3 ký tự)' });
    }
  });

function revalidateStock(variantId: string) {
  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${variantId}`);
  revalidatePath('/products');
  revalidatePath('/rentals');
  invalidatePublic('catalog');
}

export async function adjustStockAction(variantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { branch } = await requireBranchPermission('inventory.adjust');
  const parsed = adjustSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_branch_id: branch.branchId,
    p_variant_id: variantId,
    p_quantity_delta: v.direction === 'in' ? v.quantity : -v.quantity,
    p_reason: v.reason,
    p_note: v.note ?? '',
  });
  if (error) return formDbError(error);
  revalidateStock(variantId);
  const onHand = z.object({ on_hand: z.number() }).safeParse(data);
  return formSuccess(onHand.success ? `Đã cập nhật. Tồn hiện tại: ${onHand.data.on_hand}.` : 'Đã cập nhật tồn kho.');
}

const countSchema = z.object({ counted: zInt('Số đếm được', 0, 100000), note: zOptionalText(300) });

export async function recordCountAction(variantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { branch } = await requireBranchPermission('inventory.adjust');
  const parsed = countSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_stock_count', {
    p_branch_id: branch.branchId,
    p_variant_id: variantId,
    p_counted_quantity: parsed.data.counted,
    p_note: parsed.data.note ?? 'Kiểm kê',
  });
  if (error) return formDbError(error);
  revalidateStock(variantId);
  const res = z.object({ delta: z.number() }).safeParse(data);
  const delta = res.success ? res.data.delta : 0;
  return formSuccess(delta === 0 ? 'Khớp sổ — không cần điều chỉnh.' : `Đã ghi chênh lệch ${delta > 0 ? '+' : ''}${delta}.`);
}

const firstStockSchema = z.object({
  variant_id: zUuid('mặt hàng'),
  quantity: zInt('Số lượng', 1, 100000),
  note: zOptionalText(300),
  reason: z.enum(['opening', 'purchase']),
});

/** Nhập hàng lần đầu cho mặt hàng chưa có ở chi nhánh. */
export async function receiveNewItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { branch } = await requireBranchPermission('inventory.adjust');
  const parsed = firstStockSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('adjust_stock', {
    p_branch_id: branch.branchId,
    p_variant_id: v.variant_id,
    p_quantity_delta: v.quantity,
    p_reason: v.reason,
    p_note: v.note ?? '',
  });
  if (error) return formDbError(error);
  revalidateStock(v.variant_id);
  redirect(`/admin/inventory/${v.variant_id}`);
}
