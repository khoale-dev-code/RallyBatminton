import { TextField } from '@/components/ui/form';

import { VIETQR_BANKS } from '../lib/bank-form';

interface BankFieldsProps {
  defaults: {
    bank_code: string | null;
    bank_account_no: string | null;
    bank_account_name: string | null;
    transfer_memo_prefix: string | null;
  } | null;
  /** Gợi ý khi để trống (ví dụ "Dùng tài khoản thương hiệu"). */
  emptyHint?: string;
}

/** Ngân hàng + số tài khoản + chủ tài khoản (dùng ở Cài đặt thương hiệu và Chi nhánh). */
export function BankFields({ defaults, emptyHint }: BankFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="bank_code"
          label="Ngân hàng"
          list="vietqr-banks"
          defaultValue={defaults?.bank_code ?? ''}
          placeholder="MBBank"
          autoComplete="off"
          optional
          hint={emptyHint ?? 'Tên viết tắt theo VietQR, ví dụ MBBank, Vietcombank, TPBank.'}
        />
        <TextField
          name="bank_account_no"
          label="Số tài khoản"
          defaultValue={defaults?.bank_account_no ?? ''}
          inputMode="numeric"
          autoComplete="off"
          optional
        />
      </div>
      <TextField
        name="bank_account_name"
        label="Chủ tài khoản"
        defaultValue={defaults?.bank_account_name ?? ''}
        placeholder="NGUYEN VAN A"
        className="uppercase"
        optional
      />
      <TextField
        name="transfer_memo_prefix"
        label="Chữ bắt buộc trong nội dung CK"
        defaultValue={defaults?.transfer_memo_prefix ?? ''}
        placeholder="SEVQR"
        className="uppercase"
        autoComplete="off"
        optional
        hint="Chỉ điền khi SePay yêu cầu (VietinBank cá nhân: SEVQR — để trống sẽ tự điền). Nội dung khách chuyển: SEVQR RB7K3M9Q2T."
      />
      <datalist id="vietqr-banks">
        {VIETQR_BANKS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  );
}
