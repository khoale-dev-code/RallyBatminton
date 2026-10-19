import 'server-only';

import { type AppSupabaseClient } from '@/lib/supabase/server';

/** Nhân viên chỉ có SĐT vẫn cần email cho Supabase Auth: dùng email bí danh nội bộ, không gửi thư. */
export function aliasEmailForPhone(localPhone: string): string {
  return `sdt${localPhone}@nhanvien.rally.invalid`;
}

export function isAliasEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith('@nhanvien.rally.invalid'));
}

const BAN_FOREVER = '876000h';

/** Khóa/mở đăng nhập ở tầng Auth (bổ sung cho cờ is_active mà RLS đọc). */
export async function setAuthBan(secret: AppSupabaseClient, userId: string, banned: boolean): Promise<string | null> {
  const { error } = await secret.auth.admin.updateUserById(userId, { ban_duration: banned ? BAN_FOREVER : 'none' });
  return error ? error.message : null;
}

/** Mật khẩu tạm dễ đọc qua điện thoại: bỏ ký tự dễ nhầm (0/O, 1/l). */
export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Mã lỗi tạo tài khoản (đưa lên URL bằng mã cố định, không đưa văn bản tùy ý). */
export const ACCOUNT_ERRORS = {
  no_login: 'Cần email hoặc số điện thoại để đăng nhập.',
  no_secret: 'Máy chủ chưa cấu hình SUPABASE_SECRET_KEY nên chưa tạo được tài khoản.',
  exists: 'Email hoặc số điện thoại này đã có tài khoản.',
  auth_failed: 'Supabase Auth không tạo được tài khoản. Kiểm tra email và thử lại.',
  save_failed: 'Không lưu được hồ sơ tài khoản; tài khoản Auth vừa tạo đã được gỡ.',
} as const;

export type AccountErrorCode = keyof typeof ACCOUNT_ERRORS;

export function isAccountErrorCode(value: string | undefined): value is AccountErrorCode {
  return value !== undefined && value in ACCOUNT_ERRORS;
}
