'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';

import { getStaffContext } from '@/lib/auth/context';
import { toUserMessage } from '@/lib/errors';
import { formError, formSuccess, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

import { isAllowedPushEndpoint } from './lib/push';
import { dispatchPushSafely } from './send';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
  label: z.string().max(120).optional(),
});

export type PushResult = { ok: true } | { ok: false; error: string };

/** Lưu thiết bị vừa bật thông báo (gắn với tài khoản đang đăng nhập). Gọi lại mỗi phiên để thiết bị dùng chung chuyển đúng người. */
export async function registerPushAction(input: unknown): Promise<PushResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dữ liệu đăng ký thông báo không hợp lệ.' };
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) return { ok: false, error: toUserMessage({ message: 'PUSH_ENDPOINT_NOT_ALLOWED' }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_label: parsed.data.label ?? null,
  });
  if (error) return { ok: false, error: toUserMessage(error) };
  return { ok: true };
}

export async function unregisterPushAction(endpoint: string): Promise<PushResult> {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return { ok: false, error: 'Thiết bị không hợp lệ.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint });
  if (error) return { ok: false, error: toUserMessage(error) };
  return { ok: true };
}

export async function sendTestPushAction(): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('send_test_push');
  if (error) return formError(toUserMessage(error));
  after(dispatchPushSafely);
  return formSuccess(`Đã gửi thử tới ${data} thiết bị. Thông báo sẽ hiện trong vài giây.`);
}

export async function savePushPrefsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getStaffContext();
  if (!ctx) return formError('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');
  const on = (k: string) => formData.get(k) === 'on';
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_preferences', {
    p_booking_new: on('booking_new'),
    p_deposit_paid: on('deposit_paid'),
    p_payment_review: on('payment_review'),
    // Nhân viên không nhận cảnh báo bảo mật (database cũng không gửi) — giữ giá trị bật để không đổi gì.
    p_security: ctx.role === 'owner' ? on('security') : true,
  });
  if (error) return formError(toUserMessage(error));
  revalidatePath('/admin/app');
  return formSuccess('Đã lưu loại thông báo muốn nhận.');
}
