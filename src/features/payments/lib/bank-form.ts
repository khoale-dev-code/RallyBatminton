import { z } from 'zod';

/** Tên viết tắt ngân hàng theo VietQR (dùng cho ô gợi ý; nhập mã khác cũng được, ví dụ BIN 970422). */
export const VIETQR_BANKS = [
  'Vietcombank',
  'VietinBank',
  'BIDV',
  'Agribank',
  'MBBank',
  'Techcombank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'HDBank',
  'VIB',
  'SHB',
  'MSB',
  'OCB',
  'SeABank',
  'LPBank',
  'Eximbank',
  'NamABank',
  'KienLongBank',
  'BacABank',
  'PVcomBank',
  'ABBANK',
  'VietABank',
  'NCB',
  'BaoVietBank',
] as const;

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v);

/** Ba ô tài khoản ngân hàng: để trống cả ba, hoặc điền đủ ngân hàng + số tài khoản. */
export const bankFieldsSchema = z
  .object({
    bank_code: z.preprocess(
      blank,
      z
        .string()
        .regex(/^[A-Za-z0-9]{2,20}$/, 'Nhập tên viết tắt ngân hàng (ví dụ MBBank) hoặc mã BIN')
        .optional(),
    ),
    bank_account_no: z.preprocess(
      (v) => (typeof v === 'string' ? blank(v.replace(/[\s.-]/g, '')) : v),
      z
        .string()
        .regex(/^[A-Za-z0-9]{4,30}$/, 'Số tài khoản gồm 4–30 chữ số / chữ cái')
        .optional(),
    ),
    bank_account_name: z.preprocess(blank, z.string().min(2, 'Tên chủ tài khoản quá ngắn').max(80, 'Tối đa 80 ký tự').optional()),
    transfer_memo_prefix: z.preprocess(
      blank,
      z
        .string()
        .regex(/^[A-Za-z0-9]{2,20}$/, 'Chỉ gồm chữ và số, 2–20 ký tự (ví dụ SEVQR)')
        .optional(),
    ),
  })
  .refine((v) => Boolean(v.bank_code) === Boolean(v.bank_account_no), {
    path: ['bank_account_no'],
    message: 'Điền cả ngân hàng và số tài khoản (hoặc để trống cả hai)',
  });

export function bankColumns(v: z.infer<typeof bankFieldsSchema>) {
  return {
    bank_code: v.bank_code ?? null,
    bank_account_no: v.bank_account_no ?? null,
    bank_account_name: v.bank_account_name ? v.bank_account_name.toUpperCase() : null,
    transfer_memo_prefix: memoPrefixFor(v.bank_code, v.transfer_memo_prefix),
  };
}

/** VietinBank (cá nhân) qua SePay bắt buộc có "SEVQR" trong nội dung — tự điền nếu chủ sân để trống. */
export function memoPrefixFor(bankCode: string | undefined, prefix: string | undefined): string | null {
  if (!bankCode) return null;
  if (prefix) return prefix.toUpperCase();
  return /^(vietinbank|icb|ctg|970415)$/i.test(bankCode) ? 'SEVQR' : null;
}
