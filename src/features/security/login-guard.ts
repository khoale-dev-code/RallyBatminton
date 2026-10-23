import 'server-only';

import { after } from 'next/server';

import { requestMeta } from '@/features/privacy/request-meta';
import { createSecretClient } from '@/lib/supabase/secret';

import { sendSecurityAlertsSafely } from './alerts';

export type LoginScope = 'staff' | 'member';

/**
 * Chống dò mật khẩu: sai N lần → khóa tài khoản đó M phút; một mạng sai hàng loạt → khóa mạng đó.
 * Không phân biệt tài khoản có tồn tại hay không (không lộ danh sách tài khoản).
 * Database chưa chạy 23_security_hardening.sql / thiếu khóa máy chủ → cho qua (không khóa nhầm cả hệ thống).
 */
export async function loginLockSeconds(scope: LoginScope, login: string): Promise<number> {
  try {
    const { ipHash } = await requestMeta('login');
    const { data, error } = await createSecretClient().rpc('service_login_check', {
      p_scope: scope,
      p_login: login,
      p_ip_hash: ipHash,
    });
    if (error) {
      if (error.code !== 'PGRST202') console.error('[login-guard] check:', error.message);
      return 0;
    }
    return typeof data === 'number' && data > 0 ? data : 0;
  } catch {
    return 0;
  }
}

/**
 * Ghi kết quả đăng nhập. Ghi NGAY (không để sau) để nhiều lần thử song song cũng bị đếm đủ;
 * chỉ việc gửi email cảnh báo chạy sau khi đã trả lời người dùng.
 */
export async function recordLoginResult(scope: LoginScope, login: string, success: boolean): Promise<void> {
  try {
    const { ipHash } = await requestMeta('login');
    const { error } = await createSecretClient().rpc('service_login_record', {
      p_scope: scope,
      p_login: login,
      p_ip_hash: ipHash,
      p_success: success,
    });
    if (error && error.code !== 'PGRST202') console.error('[login-guard] record:', error.message);
  } catch (error) {
    console.error('[login-guard] record:', error instanceof Error ? error.message : error);
  }
  if (!success) after(sendSecurityAlertsSafely);
}
