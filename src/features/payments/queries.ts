import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { getBrandInfo } from '@/features/brand/queries';
import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { createPublicClient } from '@/lib/supabase/public';

import { type BankAccount, type BankAccounts } from './lib/transfer';

const fetchBranchAccounts = unstable_cache(
  async (): Promise<Record<string, BankAccount>> => {
    const { data, error } = await createPublicClient()
      .from('branches')
      .select('id, bank_code, bank_account_no, bank_account_name, transfer_memo_prefix')
      .not('bank_code', 'is', null);
    if (error) throw new Error(error.message);
    const out: Record<string, BankAccount> = {};
    for (const b of data) {
      if (b.bank_code && b.bank_account_no) {
        out[b.id] = {
          bankCode: b.bank_code,
          accountNo: b.bank_account_no,
          accountName: b.bank_account_name,
          memoPrefix: b.transfer_memo_prefix,
        };
      }
    }
    return out;
  },
  ['branch-bank-accounts', 'v2'],
  { tags: [PUBLIC_TAGS.branches], revalidate: PUBLIC_REVALIDATE.branches },
);

/** Tài khoản nhận chuyển khoản công khai (hiện mã QR cọc cho khách). */
export const getBankAccounts = cache(async (): Promise<BankAccounts> => {
  if (!isSupabaseConfigured()) return { brand: null, branches: {} };
  const [brand, branches] = await Promise.all([getBrandInfo(), fetchBranchAccounts().catch(() => ({}))]);
  return { brand: brand.bank, branches };
});
