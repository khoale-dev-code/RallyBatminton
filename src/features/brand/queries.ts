import 'server-only';

import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';
import { DEFAULT_BRAND_TAX, isTaxMethod, type BrandTax } from '@/lib/tax';

export interface BrandInfo {
  name: string;
  hotline: string | null;
  email: string | null;
  addressLine: string | null;
  facebookUrl: string | null;
  zaloUrl: string | null;
  paymentInstructions: string | null;
}

const FALLBACK: BrandInfo = {
  name: 'Rally Badminton',
  hotline: null,
  email: null,
  addressLine: null,
  facebookUrl: null,
  zaloUrl: null,
  paymentInstructions: null,
};

export const getBrandInfo = cache(async (): Promise<BrandInfo> => {
  if (!isSupabaseConfigured()) return FALLBACK;
  const { data, error } = await createPublicClient()
    .from('brand_settings')
    .select('name, hotline, email, address_line, facebook_url, zalo_url, payment_instructions')
    .maybeSingle();
  if (error || !data) return FALLBACK;
  return {
    name: data.name,
    hotline: data.hotline,
    email: data.email,
    addressLine: data.address_line,
    facebookUrl: data.facebook_url,
    zaloUrl: data.zalo_url,
    paymentInstructions: data.payment_instructions,
  };
});

export interface BrandTaxInfo extends BrandTax {
  taxCode: string | null;
}

/** Cách tính thuế của thương hiệu (cài đặt ở Cài đặt thương hiệu > Thuế). */
export const getBrandTax = cache(async (): Promise<BrandTaxInfo> => {
  const fallback: BrandTaxInfo = { ...DEFAULT_BRAND_TAX, taxCode: null };
  if (!isSupabaseConfigured()) return fallback;
  const { data, error } = await createPublicClient().from('brand_settings').select('tax_method, default_vat_rate, tax_code').maybeSingle();
  if (error || !data) return fallback;
  return {
    method: isTaxMethod(data.tax_method) ? data.tax_method : 'deduction',
    defaultVatRate: Number(data.default_vat_rate),
    taxCode: data.tax_code,
  };
});
