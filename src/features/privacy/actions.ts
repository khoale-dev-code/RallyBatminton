'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { verifyTurnstile } from '@/features/booking/turnstile';
import { getMemberProfile } from '@/features/member/queries';
import { getAuthUserId } from '@/lib/auth/context';
import { requireOwner } from '@/lib/auth/guards';
import { toUserMessage } from '@/lib/errors';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { invalidatePublic } from '@/lib/public-cache';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { zCheckbox, zOptionalVnPhone, zText, zUuid } from '@/lib/validation';

import { CONSENT_TEXT, LEGAL_CODES, type LegalCode } from './consent-text';
import { unknownPlaceholders } from './lib/markup';
import { DATA_REQUEST_KIND_VALUES } from './lib/policy';
import { requestMeta } from './request-meta';

// ---- Khách gửi yêu cầu về dữ liệu cá nhân --------------------------------------------------------

export interface DataRequestState extends FormState {
  result?: { code: string; kind: string; verified: boolean; ackDueAt: string; dueAt: string };
}

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Email không hợp lệ').max(160).optional(),
);

const dataRequestSchema = z
  .object({
    kind: z.enum(DATA_REQUEST_KIND_VALUES, { error: 'Chọn loại yêu cầu' }),
    name: zText('họ tên', 2, 80),
    phone: zOptionalVnPhone(),
    email: optionalEmail,
    bookingCode: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/\s/g, '') || undefined : v),
      z
        .string()
        .regex(/^[A-Z0-9-]{6,20}$/, 'Mã đơn không hợp lệ')
        .optional(),
    ),
    details: zText('nội dung yêu cầu', 5, 2000),
    confirm: zCheckbox().refine((v) => v, 'Vui lòng xác nhận bạn là chủ dữ liệu hoặc người được ủy quyền.'),
    turnstileToken: z.string().optional(),
  })
  .refine((v) => Boolean(v.phone ?? v.email), { message: 'Để lại số điện thoại hoặc email để Rally phản hồi.', path: ['phone'] });

export async function submitDataRequestAction(_prev: DataRequestState, formData: FormData): Promise<DataRequestState> {
  const userId = await getAuthUserId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = dataRequestSchema.safeParse(userId ? { ...raw, phone: raw.phone || undefined } : raw);
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;

  // Thành viên đã đăng nhập: đã xác thực qua phiên → không cần Turnstile.
  if (!userId && !(await verifyTurnstile(v.turnstileToken ?? '', 'data_request'))) {
    return formError('Xác minh chống spam không thành công. Vui lòng thử lại.', { turnstileToken: 'Hãy xác minh lại' });
  }
  const meta = await requestMeta('dsr');
  const { data, error } = await createSecretClient().rpc('service_submit_data_request', {
    p_kind: v.kind,
    p_name: v.name,
    p_phone: v.phone ?? null,
    p_email: v.email ?? null,
    p_booking_code: v.bookingCode ?? null,
    p_details: v.details,
    p_user_id: userId,
    p_ip_hash: meta.ipHash,
  });
  if (error) return formError(toUserMessage(error));
  const result = z
    .object({ code: z.string(), kind: z.string(), verified: z.boolean(), ack_due_at: z.string(), due_at: z.string() })
    .safeParse(data);
  if (!result.success) return formSuccess('Đã gửi yêu cầu.');
  return {
    ...formSuccess('Đã gửi yêu cầu.'),
    result: {
      code: result.data.code,
      kind: result.data.kind,
      verified: result.data.verified,
      ackDueAt: result.data.ack_due_at,
      dueAt: result.data.due_at,
    },
  };
}

// ---- Thành viên: nhận tin, tải dữ liệu ---------------------------------------------------------

export async function memberSetMarketingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await getMemberProfile();
  if (!profile) return formError('Vui lòng đăng nhập lại.');
  const granted = formData.get('marketing') === 'on';
  const meta = await requestMeta('consent');
  const supabase = await createClient();
  const { error } = await supabase.rpc('member_set_marketing', {
    p_granted: granted,
    p_wording: granted ? CONSENT_TEXT.marketingAccount : `Rút lại: ${CONSENT_TEXT.marketingAccount}`,
    p_user_agent: meta.userAgent,
  });
  if (error) return formDbError(error);
  revalidatePath('/account/privacy');
  revalidatePath('/account/profile');
  return formSuccess(granted ? 'Đã bật nhận tin ưu đãi.' : 'Đã tắt nhận tin — Rally ngừng gửi tin khuyến mãi cho bạn.');
}

/** Tải toàn bộ dữ liệu của thành viên (JSON). */
export async function exportMyDataAction(): Promise<{ ok: true; json: string; fileName: string } | { ok: false; error: string }> {
  const profile = await getMemberProfile();
  if (!profile) return { ok: false, error: 'Vui lòng đăng nhập lại.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_data_export');
  if (error) return { ok: false, error: toUserMessage(error) };
  const day = new Date().toISOString().slice(0, 10);
  return { ok: true, json: JSON.stringify(data, null, 2), fileName: `rally-du-lieu-cua-toi-${day}.json` };
}

// ---- Chủ sân -----------------------------------------------------------------------------------

function revalidatePrivacy(id?: string) {
  revalidatePath('/admin/privacy');
  if (id) revalidatePath(`/admin/privacy/requests/${id}`);
}

const STATUS_VALUES = ['in_progress', 'extended', 'completed', 'rejected', 'cancelled'] as const;

export async function updateDataRequestAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  if (!zUuid().safeParse(id).success) return formError('Yêu cầu không hợp lệ.');
  const parsed = z
    .object({
      status: z.enum(STATUS_VALUES, { error: 'Chọn trạng thái' }),
      note: z.string().trim().max(2000).optional(),
      verified: zCheckbox(),
      extensionReason: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_data_request', {
    p_id: id,
    p_status: v.status,
    p_note: v.note || null,
    p_verified: v.verified ? true : null,
    p_extension_reason: v.extensionReason || null,
  });
  if (error) return formDbError(error);
  revalidatePrivacy(id);
  return formSuccess('Đã cập nhật yêu cầu.');
}

/** Ẩn danh hóa khách (thực hiện yêu cầu xóa). Thành viên: vô hiệu hóa luôn tài khoản đăng nhập. */
export async function anonymizeCustomerAction(
  customerId: string,
  requestId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  if (!zUuid().safeParse(customerId).success || (requestId && !zUuid().safeParse(requestId).success)) {
    return formError('Dữ liệu không hợp lệ.');
  }
  if (formData.get('confirm') !== 'XOA') return formError('Gõ XOA để xác nhận.', { confirm: 'Gõ đúng XOA (viết hoa)' });
  const reason = String(formData.get('reason') ?? '').trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('anonymize_customer', {
    p_customer_id: customerId,
    p_request_id: requestId,
    p_reason: reason || null,
  });
  if (error) return formDbError(error);
  const uid = z.object({ auth_user_id: z.string().nullable() }).safeParse(data);
  if (uid.success && uid.data.auth_user_id) {
    // Xóa mềm tài khoản đăng nhập: Supabase xóa liên kết Google, làm mờ email / SĐT, không đăng nhập lại được.
    const { error: authError } = await createSecretClient().auth.admin.deleteUser(uid.data.auth_user_id, true);
    if (authError) {
      console.error('[privacy] Chưa xóa được tài khoản đăng nhập:', authError.message);
      revalidatePrivacy(requestId ?? undefined);
      return formSuccess('Đã ẩn danh hóa dữ liệu. Chưa xóa được tài khoản đăng nhập — hãy xóa trong Supabase → Authentication.');
    }
  }
  revalidatePrivacy(requestId ?? undefined);
  revalidatePath(`/admin/customers/${customerId}`);
  return formSuccess('Đã ẩn danh hóa thông tin của khách.');
}

const legalSchema = z.object({
  title: zText('tiêu đề', 3, 120),
  summary: z.string().trim().max(400).optional(),
  body: z.string().trim().min(50, 'Nội dung quá ngắn').max(60000, 'Nội dung quá dài'),
  changeNote: zText('nội dung thay đổi', 3, 300),
  effectiveDate: z.preprocess((v) => (v === '' ? undefined : v), z.iso.date().optional()),
});

export async function publishLegalDocumentAction(code: LegalCode, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  if (!LEGAL_CODES.includes(code)) return formError('Văn bản không hợp lệ.');
  const parsed = legalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const unknown = unknownPlaceholders(v.body);
  if (unknown.length > 0) {
    return formError(`Có khóa không hỗ trợ: ${unknown.map((k) => `{{${k}}}`).join(', ')}.`, { body: 'Sửa hoặc xóa khóa gõ sai' });
  }
  // Ngày hiệu lực (giờ Việt Nam, 0:00) — để trống là có hiệu lực ngay.
  const effectiveAt =
    v.effectiveDate && v.effectiveDate > new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
      ? `${v.effectiveDate}T00:00:00+07:00`
      : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_legal_document', {
    p_code: code,
    p_title: v.title,
    p_summary: v.summary || null,
    p_body: v.body,
    p_change_note: v.changeNote,
    p_effective_at: effectiveAt,
  });
  if (error) return formDbError(error);
  invalidatePublic('legal');
  revalidatePath(`/admin/privacy/documents/${code}`);
  const version = z.object({ version: z.number() }).safeParse(data);
  return formSuccess(
    `Đã đăng phiên bản ${version.success ? version.data.version : 'mới'}${effectiveAt ? ` — có hiệu lực từ ${v.effectiveDate}` : ''}.`,
  );
}

export async function updateRetentionAction(code: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({
      days: z.coerce.number().int('Nhập số ngày').min(1).max(7300),
      automatic: zCheckbox(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_retention_policy', {
    p_code: code,
    p_days: parsed.data.days,
    p_automatic: parsed.data.automatic,
  });
  if (error) return formDbError(error);
  invalidatePublic('legal');
  revalidatePrivacy();
  return formSuccess('Đã lưu thời hạn lưu trữ.');
}

export async function runRetentionAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('apply_retention', { p_dry_run: false });
  if (error) return formDbError(error);
  revalidatePrivacy();
  const counts = z.record(z.string(), z.object({ due: z.number(), automatic: z.boolean() })).safeParse(data);
  const done = counts.success
    ? Object.values(counts.data)
        .filter((c) => c.automatic)
        .reduce((s, c) => s + c.due, 0)
    : 0;
  return formSuccess(done > 0 ? `Đã xử lý ${done} bản ghi hết hạn.` : 'Không có dữ liệu nào hết hạn lưu trữ.');
}

const legalInfoSchema = z.object({
  legal_name: z.string().trim().max(200).optional(),
  legal_address: z.string().trim().max(300).optional(),
  privacy_email: optionalEmail,
  privacy_contact: z.string().trim().max(120).optional(),
});

export async function saveLegalInfoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = legalInfoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('brand_settings')
    .update({
      legal_name: v.legal_name || null,
      legal_address: v.legal_address || null,
      privacy_email: v.privacy_email ?? null,
      privacy_contact: v.privacy_contact || null,
    })
    .eq('id', true);
  if (error) return formDbError(error);
  invalidatePublic('brand', 'legal');
  revalidatePath('/admin/settings');
  return formSuccess('Đã lưu thông tin pháp lý.');
}

/** Chủ sân tải dữ liệu của một khách (trả lời yêu cầu xem / nhận bản sao). */
export async function exportCustomerDataAction(
  customerId: string,
  requestId: string | null,
): Promise<{ ok: true; json: string; fileName: string } | { ok: false; error: string }> {
  await requireOwner();
  if (!zUuid().safeParse(customerId).success || (requestId && !zUuid().safeParse(requestId).success)) {
    return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('customer_data_export', { p_customer_id: customerId, p_request_id: requestId });
  if (error) return { ok: false, error: toUserMessage(error) };
  return { ok: true, json: JSON.stringify(data, null, 2), fileName: `rally-du-lieu-khach-${customerId.slice(0, 8)}.json` };
}
