'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner, requireStaff } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { zText, zUuid } from '@/lib/validation';

import { runSepayReconcile } from './reconcile';

const matchSchema = z.object({
  txnId: zUuid('giao dịch'),
  code: zText('mã đơn', 8, 20).transform((c) => c.toUpperCase().replace(/\s/g, '')),
});

/** Gán giao dịch ghi sai nội dung vào đơn (database kiểm tra quyền thu tiền ở chi nhánh của đơn). */
export async function matchBankTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = matchSchema.safeParse({ txnId: formData.get('txnId'), code: formData.get('code') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('match_bank_transaction', { p_txn_id: parsed.data.txnId, p_booking_code: parsed.data.code });
  if (error) return formDbError(error);
  const result = z.object({ note: z.string().nullish(), booking_code: z.string().nullish() }).safeParse(data);
  revalidatePath('/admin/bank');
  revalidatePath('/admin');
  return formSuccess(
    result.success && result.data.booking_code
      ? `Đã ghi tiền vào đơn ${result.data.booking_code}. ${result.data.note ?? ''}`.trim()
      : 'Đã ghi tiền vào đơn.',
  );
}

const dismissSchema = z.object({ txnId: zUuid('giao dịch'), note: zText('lý do', 3, 300) });

/** Bỏ qua giao dịch không liên quan / đã hoàn tiền tay (giữ lại lịch sử, không xóa). */
export async function dismissBankTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = dismissSchema.safeParse({ txnId: formData.get('txnId'), note: formData.get('note') });
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('dismiss_bank_transaction', { p_txn_id: parsed.data.txnId, p_note: parsed.data.note });
  if (error) return formDbError(error);
  revalidatePath('/admin/bank');
  revalidatePath('/admin');
  return formSuccess('Đã chuyển giao dịch sang “Đã xử lý”.');
}

/** Chủ sân bấm "Đối soát ngay": hỏi SePay giao dịch gần đây và ghi bù giao dịch bị lọt. */
export async function reconcileNowAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireOwner();
  const result = await runSepayReconcile('manual');
  revalidatePath('/admin/bank');
  if (!result.ok) return formError(result.message);
  revalidatePath('/admin');
  return formSuccess(
    result.created > 0
      ? `Đã ghi bù ${result.created} giao dịch bị lọt (kiểm tra ${result.fetched} giao dịch).`
      : `Đã kiểm tra ${result.fetched} giao dịch gần đây — không có giao dịch nào bị lọt.`,
  );
}
