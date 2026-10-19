import { z } from 'zod';

/** Một giao dịch trong SePay API v1 (GET /userapi/transactions/list) — số tiền trả về dạng chuỗi "42000.00". */
const money = z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().finite().nonnegative()).catch(0);
const text = z.string().nullish().catch(null);

export const sepayApiTransactionSchema = z.looseObject({
  id: z.union([z.string().trim().regex(/^\d{1,30}$/), z.number().int().nonnegative()]),
  bank_brand_name: text,
  account_number: text,
  sub_account: text,
  transaction_date: z.string(),
  amount_in: money,
  amount_out: money,
  accumulated: money,
  transaction_content: text,
  reference_number: text,
  code: text,
});
export type SepayApiTransaction = z.infer<typeof sepayApiTransactionSchema>;

export const sepayApiListSchema = z.looseObject({
  status: z.number().optional(),
  error: z.unknown().optional(),
  transactions: z.array(z.unknown()).catch([]),
});

/** Đổi giao dịch API sang đúng dạng webhook để dùng chung một hàm ghi (record_sepay_transaction). */
export function apiTransactionToPayload(t: SepayApiTransaction): Record<string, string | number | null> | null {
  if (t.amount_in <= 0) return null;
  return {
    id: typeof t.id === 'number' ? t.id : Number(t.id) <= Number.MAX_SAFE_INTEGER ? Number(t.id) : t.id,
    gateway: t.bank_brand_name ?? null,
    transactionDate: t.transaction_date,
    accountNumber: t.account_number ?? null,
    subAccount: t.sub_account ?? null,
    code: t.code ?? null,
    content: t.transaction_content ?? null,
    transferType: 'in',
    transferAmount: Math.round(t.amount_in),
    accumulated: Math.round(t.accumulated),
    referenceCode: t.reference_number ?? null,
    description: 'Ghi bù khi đối soát với SePay API',
  };
}

/** "YYYY-MM-DD HH:mm:ss" theo giờ Việt Nam — định dạng SePay API nhận. */
export function sepayDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
