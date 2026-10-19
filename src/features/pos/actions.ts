'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { invalidatePublic } from '@/lib/public-cache';
import { requireBranchPermission } from '@/lib/auth/guards';
import { isOwner } from '@/lib/auth/permissions';
import { errorCode, toUserMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { zIdempotencyKey, zManualPaymentMethod, zOptionalText, zOptionalVnPhone } from '@/lib/validation';

const saleInputSchema = z.object({
  lines: z
    .array(z.object({ variantId: z.uuid(), unitId: z.uuid().nullable().optional(), quantity: z.number().int().min(1).max(1000) }))
    .min(1, 'Giỏ hàng đang trống')
    .max(30, 'Tối đa 30 dòng mỗi đơn'),
  paymentMethod: zManualPaymentMethod(),
  paymentReference: zOptionalText(100),
  discount: z.number().int().min(0).max(100_000_000),
  customerPhone: zOptionalVnPhone(),
  customerName: zOptionalText(80),
  note: zOptionalText(300),
  idempotencyKey: zIdempotencyKey(),
});

export type SaleInput = z.input<typeof saleInputSchema>;

export type SaleResult =
  | { ok: true; saleId: string; code: string; total: number; replayed: boolean }
  | { ok: false; error: string; code?: string };

const rpcResult = z.object({ sale_id: z.uuid(), code: z.string(), total_amount: z.number(), replayed: z.boolean().optional() });

export async function recordSaleAction(input: SaleInput): Promise<SaleResult> {
  const { ctx, branch } = await requireBranchPermission('sale.record');
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu đơn không hợp lệ.' };
  const v = parsed.data;
  if (v.discount > 0 && !isOwner(ctx)) return { ok: false, error: 'Chỉ chủ sân được giảm giá.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_sale', {
    p_branch_id: branch.branchId,
    p_lines: v.lines.map((l) => ({ variant_id: l.variantId, unit_id: l.unitId ?? null, quantity: l.quantity })),
    p_payment_method: v.paymentMethod,
    p_payment_reference: v.paymentReference,
    p_discount_amount: v.discount,
    p_customer_phone: v.customerPhone,
    p_customer_name: v.customerName,
    p_note: v.note,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return { ok: false, error: toUserMessage(error), code: errorCode(error) ?? undefined };
  const res = rpcResult.safeParse(data);
  if (!res.success) return { ok: false, error: 'Không đọc được kết quả đơn bán.' };
  revalidatePath('/admin/sales');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin');
  invalidatePublic('catalog');
  return { ok: true, saleId: res.data.sale_id, code: res.data.code, total: res.data.total_amount, replayed: res.data.replayed ?? false };
}
