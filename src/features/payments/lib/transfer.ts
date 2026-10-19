/**
 * Nội dung chuyển khoản: mã đơn bỏ gạch (ngân hàng hay xóa ký tự đặc biệt). RB-7K3M9Q2T → RB7K3M9Q2T.
 * Tài khoản cần chữ bắt buộc (VietinBank cá nhân qua SePay: SEVQR) → "SEVQR RB7K3M9Q2T".
 */
export function transferContent(bookingCode: string, memoPrefix?: string | null): string {
  const code = bookingCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const prefix = memoPrefix?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return prefix ? `${prefix} ${code}` : code;
}

export interface BankAccount {
  bankCode: string;
  accountNo: string;
  accountName: string | null;
  /** Chữ bắt buộc trước mã đơn trong nội dung (null = không cần). */
  memoPrefix?: string | null;
}

/** Ảnh VietQR do SePay tạo (quét bằng mọi app ngân hàng; đã điền sẵn số tiền + nội dung). */
export function vietQrImageUrl(account: BankAccount, amount: number, content: string, options: { download?: boolean } = {}): string {
  const params = new URLSearchParams({
    acc: account.accountNo,
    bank: account.bankCode,
    amount: String(Math.max(0, Math.round(amount))),
    des: content,
    template: 'compact',
  });
  if (options.download) params.set('download', 'true');
  return `https://vietqr.app/img?${params.toString()}`;
}

/** Số tiền khách cần chuyển: phần cọc còn thiếu, hoặc toàn bộ phần còn lại. */
export function amountsDue(total: number, deposit: number, paid: number): { deposit: number; full: number } {
  const full = Math.max(0, total - paid);
  return { deposit: Math.min(full, Math.max(0, deposit - paid)), full };
}

/** Tài khoản chi nhánh (nếu chi nhánh cài riêng), không thì tài khoản thương hiệu. */
export function resolveBankAccount(
  branch: {
    bank_code?: string | null;
    bank_account_no?: string | null;
    bank_account_name?: string | null;
    transfer_memo_prefix?: string | null;
  } | null,
  brand: BankAccount | null | undefined,
): BankAccount | null {
  if (branch?.bank_code && branch.bank_account_no) {
    return {
      bankCode: branch.bank_code,
      accountNo: branch.bank_account_no,
      accountName: branch.bank_account_name ?? brand?.accountName ?? null,
      memoPrefix: branch.transfer_memo_prefix ?? null,
    };
  }
  return brand?.bankCode && brand.accountNo ? brand : null;
}

export interface BankAccounts {
  brand: BankAccount | null;
  /** Chi nhánh dùng tài khoản riêng (id → tài khoản). */
  branches: Record<string, BankAccount>;
}

/** Chọn tài khoản cho một đơn theo chi nhánh của đơn. */
export function accountForBranch(accounts: BankAccounts, branchId: string): BankAccount | null {
  return resolveBankAccount(null, accounts.branches[branchId] ?? accounts.brand);
}
