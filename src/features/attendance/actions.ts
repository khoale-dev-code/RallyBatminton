'use server';

import { createHash, randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireOwner, requireStaff } from '@/lib/auth/guards';
import { toUserMessage } from '@/lib/errors';
import { formError, formSuccess, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/format';
import { siteOrigin } from '@/lib/site-origin';
import { formDataToObject, zUuid } from '@/lib/validation';

export type IssueQrResult = { ok: true; url: string; expiresAt: string } | { ok: false; error: string };

/**
 * Tạo mã QR chấm công (hiệu lực 90 giây). Token ngẫu nhiên chỉ nằm trong QR;
 * database chỉ lưu SHA-256 nên lộ bảng cũng không giả mạo được mã.
 */
export async function issueQrAction(branchId: string): Promise<IssueQrResult> {
  await requireOwner();
  if (!zUuid().safeParse(branchId).success) return { ok: false, error: 'Chi nhánh không hợp lệ.' };
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('issue_attendance_qr', { p_branch_id: branchId, p_token_hash: hash });
  if (error) return { ok: false, error: toUserMessage(error) };
  const res = z.object({ expires_at: z.string() }).safeParse(data);
  if (!res.success) return { ok: false, error: 'Không tạo được mã QR.' };
  // Tên miền đang mở trang (không phải NEXT_PUBLIC_SITE_URL) → điện thoại nhân viên quét là mở đúng website.
  return { ok: true, url: `${await siteOrigin()}/checkin?t=${token}`, expiresAt: res.data.expires_at };
}

const scanSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/, 'Mã QR không hợp lệ'),
  event: z.enum(['checkin', 'checkout']),
});

export async function scanAttendanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = scanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formError('Mã QR không hợp lệ. Quét lại mã trên màn hình quầy.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('scan_attendance_qr', { p_token: parsed.data.token, p_event: parsed.data.event });
  if (error) return formError(toUserMessage(error));
  revalidatePath('/checkin');
  revalidatePath('/admin/me');
  const res = z.object({ event: z.string(), at: z.string(), paid_minutes: z.number().optional() }).safeParse(data);
  const at = res.success ? formatTime(res.data.at) : '';
  if (parsed.data.event === 'checkin') return formSuccess(`Đã vào ca lúc ${at}. Chúc ca làm suôn sẻ!`);
  const minutes = res.success ? (res.data.paid_minutes ?? 0) : 0;
  return formSuccess(`Đã ra ca lúc ${at}. Công ghi nhận: ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút.`);
}
