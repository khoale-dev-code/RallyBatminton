'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { invalidatePublic } from '@/lib/public-cache';
import { getStaffContext } from '@/lib/auth/context';
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
  | {
      ok: true;
      saleId: string;
      code: string;
      total: number;
      replayed: boolean;
      /** Chuyển khoản qua QR: nội dung RB… khách cần ghi, tiền chưa về (null = đã thu). */
      transferCode: string | null;
    }
  | { ok: false; error: string; code?: string };

const rpcResult = z.object({
  sale_id: z.uuid(),
  code: z.string(),
  total_amount: z.number(),
  replayed: z.boolean().optional(),
  transfer_code: z.string().nullish(),
  payment_status: z.string().optional(),
});

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
  return {
    ok: true,
    saleId: res.data.sale_id,
    code: res.data.code,
    total: res.data.total_amount,
    replayed: res.data.replayed ?? false,
    transferCode: res.data.payment_status === 'pending' ? (res.data.transfer_code ?? null) : null,
  };
}

const transferStatusSchema = z.object({
  sale_status: z.string(),
  total_amount: z.number(),
  paid: z.number(),
  pending: z.object({ payment_id: z.string(), amount: z.number(), reference: z.string() }).nullable(),
});
export type SaleTransferStatus = z.infer<typeof transferStatusSchema>;

/** Màn chờ khách quét QR hỏi lại: tiền đã về chưa (SePay ghi nhận tự động). */
export async function saleTransferStatusAction(saleId: string): Promise<SaleTransferStatus | null> {
  await requireBranchPermission('sale.record');
  if (!z.uuid().safeParse(saleId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('sale_transfer_status', { p_sale_id: saleId });
  if (error) return null;
  const parsed = transferStatusSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Khách đổi ý trả tiền mặt / thẻ, hoặc nhân viên đã thấy tiền về và nhập mã giao dịch. */
export async function settlePendingSaleAction(
  saleId: string,
  method: 'cash' | 'bank_transfer',
  reference?: string,
): Promise<{ ok: true; status: SaleTransferStatus } | { ok: false; error: string }> {
  await requireBranchPermission('sale.record');
  const ref = reference?.trim() || null;
  if (method === 'bank_transfer' && (!ref || ref.length < 3))
    return { ok: false, error: 'Nhập mã giao dịch ngân hàng (tối thiểu 3 ký tự).' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('settle_pending_sale', {
    p_sale_id: saleId,
    p_method: method,
    p_reference: ref,
    p_idempotency_key: `settle:${saleId}:${method}`,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  const parsed = transferStatusSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: 'Không đọc được trạng thái đơn.' };
  revalidatePath('/admin/sales');
  return { ok: true, status: parsed.data };
}

/** Hủy đơn đang chờ chuyển khoản (khách không chuyển): trả hàng về kho, giữ lịch sử. */
export async function cancelPendingSaleAction(saleId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBranchPermission('sale.record');
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: 'Nhập lý do hủy (tối thiểu 3 ký tự).' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_pending_sale', { p_sale_id: saleId, p_reason: why });
  if (error) return { ok: false, error: toUserMessage(error) };
  revalidatePath('/admin/sales');
  revalidatePath('/admin/inventory');
  invalidatePublic('catalog');
  return { ok: true };
}

// ---- Bán hàng khi mất mạng (26_offline_pos.sql) ------------------------------------------------------------

const offlineSaleInputSchema = z.object({
  idempotencyKey: zIdempotencyKey(),
  sellerId: z.uuid(),
  branchId: z.uuid(),
  soldAt: z.iso.datetime({ offset: true }),
  lines: z
    .array(z.object({ variantId: z.uuid(), unitId: z.uuid().nullable(), quantity: z.number().int().min(1).max(1000) }))
    .min(1)
    .max(30),
  discount: z.number().int().min(0).max(100_000_000),
  expectedTotal: z.number().int().min(0),
  note: z.string().max(250).nullable(),
  acceptServerTotal: z.boolean(),
});

export type OfflineSaleResult =
  | { ok: true; saleId: string; code: string; total: number; replayed: boolean }
  | { ok: false; error: string; code?: string; serverTotal?: number };

/**
 * Gửi một đơn bán lúc mất mạng lên máy chủ. Người gửi phải đúng là người đã bán (đơn ghi tên thu ngân);
 * giá, kho, quyền, chống trùng do database kiểm như bán thường.
 */
export async function recordOfflineSaleAction(input: unknown): Promise<OfflineSaleResult> {
  const parsed = offlineSaleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dữ liệu đơn bán khi mất mạng không hợp lệ.', code: 'INVALID_INPUT' };
  const v = parsed.data;
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, error: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.', code: 'AUTH_REQUIRED' };
  if (ctx.userId !== v.sellerId)
    return { ok: false, error: toUserMessage({ message: 'OFFLINE_SELLER_MISMATCH' }), code: 'OFFLINE_SELLER_MISMATCH' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_offline_sale', {
    p_branch_id: v.branchId,
    p_lines: v.lines.map((l) => ({ variant_id: l.variantId, unit_id: l.unitId, quantity: l.quantity })),
    p_discount_amount: v.discount,
    p_sold_at: v.soldAt,
    p_expected_total: v.expectedTotal,
    p_idempotency_key: v.idempotencyKey,
    p_note: v.note,
    p_accept_server_total: v.acceptServerTotal,
  });
  if (error) {
    const code = errorCode(error) ?? undefined;
    const serverTotal = code === 'OFFLINE_PRICE_CHANGED' ? Number(error.details) : NaN;
    return {
      ok: false,
      error: toUserMessage(error),
      code,
      ...(Number.isFinite(serverTotal) ? { serverTotal } : {}),
    };
  }
  const res = rpcResult.safeParse(data);
  if (!res.success) return { ok: false, error: 'Không đọc được kết quả đơn bán.' };
  revalidatePath('/admin/sales');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin');
  invalidatePublic('catalog');
  return { ok: true, saleId: res.data.sale_id, code: res.data.code, total: res.data.total_amount, replayed: res.data.replayed ?? false };
}
