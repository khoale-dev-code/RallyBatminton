import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { createPublicClient } from '@/lib/supabase/public';
import { DEFAULT_BRAND_TAX, isTaxMethod, type BrandTax } from '@/lib/tax';
import { type BankAccount } from '@/features/payments/lib/transfer';

export interface BrandInfo {
  name: string;
  hotline: string | null;
  email: string | null;
  addressLine: string | null;
  facebookUrl: string | null;
  zaloUrl: string | null;
  paymentInstructions: string | null;
  /** Tài khoản nhận cọc chuyển khoản (null = chưa cài, khách đặt cọc theo hướng dẫn / tại quầy). */
  bank: BankAccount | null;
}

const FALLBACK: BrandInfo = {
  name: 'Rally Badminton',
  hotline: null,
  email: null,
  addressLine: null,
  facebookUrl: null,
  zaloUrl: null,
  paymentInstructions: null,
  bank: null,
};

/** Đọc từ database; lỗi thì ném ra để KHÔNG bị lưu vào cache. */
const fetchBrandInfo = unstable_cache(
  async (): Promise<BrandInfo | null> => {
    const supabase = createPublicClient();
    const [{ data, error }, bankRes] = await Promise.all([
      supabase
        .from('brand_settings')
        .select('name, hotline, email, address_line, facebook_url, zalo_url, payment_instructions')
        .maybeSingle(),
      // Đọc tách riêng: database chưa chạy SQL mới thì chỉ mất mã QR, website vẫn chạy bình thường.
      supabase.from('brand_settings').select('bank_code, bank_account_no, bank_account_name, transfer_memo_prefix').maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!data) return null;
    if (bankRes.error) console.error('[brand] Chưa đọc được tài khoản nhận cọc (đã chạy 15_sepay_deposit.sql?):', bankRes.error.message);
    const bank = bankRes.data;
    return {
      name: data.name,
      hotline: data.hotline,
      email: data.email,
      addressLine: data.address_line,
      facebookUrl: data.facebook_url,
      zaloUrl: data.zalo_url,
      paymentInstructions: data.payment_instructions,
      bank:
        bank?.bank_code && bank.bank_account_no
          ? {
              bankCode: bank.bank_code,
              accountNo: bank.bank_account_no,
              accountName: bank.bank_account_name,
              memoPrefix: bank.transfer_memo_prefix,
            }
          : null,
    };
  },
  // Đổi phiên bản khi đổi dạng dữ liệu → không đọc nhầm bản cache cũ (thiếu tài khoản ngân hàng).
  ['brand-info', 'v4'],
  { tags: [PUBLIC_TAGS.brand], revalidate: PUBLIC_REVALIDATE.brand },
);

/** Thông tin thương hiệu (cache phía máy chủ; xóa cache khi lưu Cài đặt). */
export const getBrandInfo = cache(async (): Promise<BrandInfo> => {
  if (!isSupabaseConfigured()) return FALLBACK;
  try {
    return (await fetchBrandInfo()) ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
});

export interface BrandTaxInfo extends BrandTax {
  taxCode: string | null;
}

/** Cách tính thuế của thương hiệu (cài đặt ở Cài đặt thương hiệu > Thuế). */
const fetchBrandTax = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from('brand_settings')
      .select('tax_method, default_vat_rate, tax_code')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  ['brand-tax'],
  { tags: [PUBLIC_TAGS.brand], revalidate: PUBLIC_REVALIDATE.brand },
);

export const getBrandTax = cache(async (): Promise<BrandTaxInfo> => {
  const fallback: BrandTaxInfo = { ...DEFAULT_BRAND_TAX, taxCode: null };
  if (!isSupabaseConfigured()) return fallback;
  const data = await fetchBrandTax().catch(() => null);
  if (!data) return fallback;
  return {
    method: isTaxMethod(data.tax_method) ? data.tax_method : 'deduction',
    defaultVatRate: Number(data.default_vat_rate),
    taxCode: data.tax_code,
  };
});
