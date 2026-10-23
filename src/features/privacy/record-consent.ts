import 'server-only';

import { createSecretClient } from '@/lib/supabase/secret';

import { CONSENT_TEXT } from './consent-text';
import { requestMeta } from './request-meta';

/**
 * Lưu bằng chứng xác nhận điều khoản (+ đồng ý nhận tin nếu chọn) của tài khoản thành viên.
 * Hàm trong database tự bỏ qua xác nhận điều khoản nếu tài khoản đã có (vd. đăng nhập Google các lần sau).
 * KHÔNG đặt trong file 'use server' — chỉ máy chủ gọi, trình duyệt không gọi trực tiếp được.
 */
export async function recordAccountConsents(userId: string, marketing: boolean, termsWording: string): Promise<void> {
  let secret;
  try {
    secret = createSecretClient();
  } catch {
    return;
  }
  const meta = await requestMeta('consent');
  const { error } = await secret.rpc('service_record_member_consents', {
    p_user_id: userId,
    p_terms_wording: termsWording,
    p_marketing: marketing,
    p_marketing_wording: CONSENT_TEXT.marketing,
    p_ip_hash: meta.ipHash,
    p_user_agent: meta.userAgent,
  });
  if (error) console.error('[privacy] Chưa lưu được bằng chứng xác nhận (đã chạy 22_privacy_security.sql?):', error.message);
}
