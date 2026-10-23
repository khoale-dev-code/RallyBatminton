import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVALIDATE, PUBLIC_TAGS } from '@/lib/public-cache';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';

import { type LegalCode } from './consent-text';
import { type BranchCancellation, type LegalDocument, type RetentionPolicy } from './types';

export type { BranchCancellation, LegalDocument, RetentionPolicy } from './types';

const LEGAL_COLUMNS = 'id, code, version, title, summary, body, change_note, effective_at, created_at';

type LegalRow = {
  id: string;
  code: string;
  version: number;
  title: string;
  summary: string | null;
  body: string;
  change_note: string | null;
  effective_at: string;
  created_at: string;
};

const toDoc = (r: LegalRow): LegalDocument => ({
  id: r.id,
  code: r.code as LegalCode,
  version: r.version,
  title: r.title,
  summary: r.summary,
  body: r.body,
  changeNote: r.change_note,
  effectiveAt: r.effective_at,
  createdAt: r.created_at,
});

/** Mọi phiên bản của một văn bản (mới nhất trước). Lỗi ném ra → không lưu cache. */
const fetchLegalVersions = unstable_cache(
  async (code: LegalCode): Promise<LegalDocument[]> => {
    const { data, error } = await createPublicClient()
      .from('legal_documents')
      .select(LEGAL_COLUMNS)
      .eq('code', code)
      .order('version', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(toDoc);
  },
  ['legal-versions', 'v1'],
  { tags: [PUBLIC_TAGS.legal], revalidate: PUBLIC_REVALIDATE.legal },
);

/** Phiên bản đang áp dụng (ngày hiệu lực ≤ bây giờ) + danh sách phiên bản đã có hiệu lực. null = chưa chạy SQL 22. */
export const getLegalDocument = cache(
  async (code: LegalCode): Promise<{ current: LegalDocument | null; versions: LegalDocument[] } | null> => {
    if (!isSupabaseConfigured()) return null;
    try {
      const now = Date.now();
      const versions = (await fetchLegalVersions(code)).filter((d) => Date.parse(d.effectiveAt) <= now);
      return { current: versions[0] ?? null, versions };
    } catch (e) {
      console.error('[legal] Không đọc được văn bản (đã chạy 22_privacy_security.sql?):', e instanceof Error ? e.message : e);
      return null;
    }
  },
);

/** Giá trị điền vào {{...}} trong văn bản. */
const fetchLegalValues = unstable_cache(
  async (): Promise<Record<string, string | null>> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from('brand_settings').select('name, hotline, email, address_line, tax_code').maybeSingle();
    if (error) throw new Error(error.message);
    // Đọc tách riêng: chưa chạy SQL 22 thì chỉ thiếu thông tin pháp lý.
    const legal = await supabase.from('brand_settings').select('legal_name, legal_address, privacy_email, privacy_contact').maybeSingle();
    return {
      ten_thuong_hieu: data?.name ?? 'Rally Badminton',
      ten_phap_ly: legal.data?.legal_name ?? null,
      ma_so_thue: data?.tax_code ?? null,
      dia_chi: legal.data?.legal_address ?? data?.address_line ?? null,
      hotline: data?.hotline ?? null,
      email: data?.email ?? null,
      email_du_lieu: legal.data?.privacy_email ?? data?.email ?? null,
      nguoi_phu_trach: legal.data?.privacy_contact ?? null,
    };
  },
  ['legal-values', 'v1'],
  { tags: [PUBLIC_TAGS.brand, PUBLIC_TAGS.legal], revalidate: PUBLIC_REVALIDATE.legal },
);

export const getLegalValues = cache(async (): Promise<Record<string, string | null>> => {
  if (!isSupabaseConfigured()) return { ten_thuong_hieu: 'Rally Badminton' };
  try {
    return await fetchLegalValues();
  } catch {
    return { ten_thuong_hieu: 'Rally Badminton' };
  }
});

/** Điều kiện giữ chỗ / cọc / hoàn cọc đang áp dụng của các chi nhánh đã công bố. */
const fetchCancellation = unstable_cache(
  async (): Promise<BranchCancellation[]> => {
    const { data, error } = await createPublicClient()
      .from('branches')
      .select('name, slug, hold_minutes, deposit_percent, free_cancel_hours, partial_refund_hours, partial_refund_percent')
      .order('name');
    if (error) throw new Error(error.message);
    return data.map((b) => ({
      name: b.name,
      slug: b.slug,
      holdMinutes: b.hold_minutes,
      depositPercent: b.deposit_percent,
      freeCancelHours: b.free_cancel_hours,
      partialRefundHours: b.partial_refund_hours,
      partialRefundPercent: b.partial_refund_percent,
    }));
  },
  ['legal-cancellation', 'v1'],
  { tags: [PUBLIC_TAGS.branches], revalidate: PUBLIC_REVALIDATE.branches },
);

export const getCancellationPolicies = cache(async (): Promise<BranchCancellation[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    return await fetchCancellation();
  } catch {
    return [];
  }
});

const toRetention = (r: {
  code: string;
  label: string;
  data_scope: string;
  retention_days: number;
  action: string;
  basis: string;
  is_automatic: boolean;
  last_run_at: string | null;
  last_run_count: number | null;
}): RetentionPolicy => ({
  code: r.code,
  label: r.label,
  dataScope: r.data_scope,
  retentionDays: r.retention_days,
  action: r.action === 'anonymize' || r.action === 'delete' ? r.action : 'keep',
  basis: r.basis,
  isAutomatic: r.is_automatic,
  lastRunAt: r.last_run_at,
  lastRunCount: r.last_run_count,
});

const RETENTION_COLUMNS = 'code, label, data_scope, retention_days, action, basis, is_automatic, last_run_at, last_run_count';

const fetchRetention = unstable_cache(
  async (): Promise<RetentionPolicy[]> => {
    const { data, error } = await createPublicClient().from('data_retention_policies').select(RETENTION_COLUMNS).order('sort_order');
    if (error) throw new Error(error.message);
    return data.map(toRetention);
  },
  ['legal-retention', 'v1'],
  { tags: [PUBLIC_TAGS.legal], revalidate: PUBLIC_REVALIDATE.legal },
);

export const getRetentionPolicies = cache(async (): Promise<RetentionPolicy[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    return await fetchRetention();
  } catch {
    return [];
  }
});

// ---- Chủ sân (RLS: chỉ chủ sân đọc được) -------------------------------------------------------

export const DATA_REQUEST_COLUMNS =
  'id, code, kind, status, requester_name, phone, email, auth_user_id, customer_id, booking_code, verified, verification_note, details, channel, received_at, ack_due_at, due_at, extended_due_at, extension_reason, acknowledged_at, resolved_at, resolution_note, redacted_at';

export async function listDataRequests(scope: 'open' | 'closed') {
  const supabase = await createClient();
  let q = supabase.from('data_subject_requests').select(DATA_REQUEST_COLUMNS).limit(100);
  q =
    scope === 'open'
      ? q.in('status', ['received', 'in_progress', 'extended']).order('due_at')
      : q.in('status', ['completed', 'rejected', 'cancelled']).order('resolved_at', { ascending: false });
  const { data, error } = await q;
  if (error) return null;
  return data;
}

export async function getDataRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('data_subject_requests')
    .select(`${DATA_REQUEST_COLUMNS}, customers(id, full_name, phone, anonymized_at, auth_user_id)`)
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getDataRequestCounts(): Promise<{ open: number; overdue: number; unacknowledged: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('data_request_counts');
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return { open: 0, overdue: 0, unacknowledged: 0 };
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  return { open: n(data.open), overdue: n(data.overdue), unacknowledged: n(data.unacknowledged) };
}

/** Mọi phiên bản (kể cả phiên bản hẹn ngày hiệu lực) — trang soạn thảo của chủ sân. */
export async function listLegalVersionsAdmin(code: LegalCode): Promise<LegalDocument[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('legal_documents')
    .select(LEGAL_COLUMNS)
    .eq('code', code)
    .order('version', { ascending: false });
  if (error) return null;
  return data.map(toDoc);
}

export async function listLatestLegalDocuments(): Promise<LegalDocument[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('legal_documents').select(LEGAL_COLUMNS).order('version', { ascending: false });
  if (error) return null;
  const seen = new Set<string>();
  return data.filter((d) => (seen.has(d.code) ? false : (seen.add(d.code), true))).map(toDoc);
}

export async function listRetentionAdmin(): Promise<RetentionPolicy[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('data_retention_policies').select(RETENTION_COLUMNS).order('sort_order');
  if (error) return null;
  return data.map(toRetention);
}

export async function listWebhookEvents(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('id, provider, received_at, auth_result, auth_method, provider_txn_id, http_status, outcome')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return data;
}

export async function getLegalInfo() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_settings')
    .select('legal_name, legal_address, privacy_email, privacy_contact, tax_code')
    .maybeSingle();
  if (error) return null;
  return data;
}

const CONSENT_COLUMNS =
  'id, purpose, granted, source, wording, created_at, booking_id, bookings(code), privacy:legal_documents!privacy_consents_privacy_doc_id_fkey(version), terms:legal_documents!privacy_consents_terms_doc_id_fkey(version)';

/** Lịch sử xác nhận / đồng ý của một khách (chủ sân) hoặc của chính thành viên (RLS). */
export async function listConsents(filter: { customerId?: string; userId?: string }, limit = 30) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((filter.customerId && !uuid.test(filter.customerId)) || (filter.userId && !uuid.test(filter.userId))) return [];
  const supabase = await createClient();
  const ors = [
    filter.customerId ? `customer_id.eq.${filter.customerId}` : null,
    filter.userId ? `auth_user_id.eq.${filter.userId}` : null,
  ].filter((v): v is string => v !== null);
  if (ors.length === 0) return [];
  const { data, error } = await supabase
    .from('privacy_consents')
    .select(CONSENT_COLUMNS)
    .or(ors.join(','))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return data;
}

/** Yêu cầu của chính thành viên (RLS). */
export async function listMyDataRequests(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('data_subject_requests')
    .select('id, code, kind, status, received_at, due_at, extended_due_at, resolved_at, resolution_note')
    .eq('auth_user_id', userId)
    .order('received_at', { ascending: false })
    .limit(20);
  if (error) return null;
  return data;
}

/** Lịch sử xác nhận / đồng ý của chính người đang đăng nhập (RLS: theo tài khoản và hồ sơ khách gắn với tài khoản). */
export async function listMyConsents(limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('privacy_consents')
    .select(CONSENT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return data;
}
