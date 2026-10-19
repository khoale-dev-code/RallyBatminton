import { z } from 'zod';

/** Luật mật khẩu chung (giống tài khoản nhân sự): 8–72 ký tự, có chữ và số. */
export const newPasswordSchema = z
  .string({ error: 'Vui lòng nhập mật khẩu' })
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[A-Za-z]/, 'Cần có ít nhất một chữ cái')
  .regex(/\d/, 'Cần có ít nhất một chữ số');

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Quá ngắn', 'Yếu', 'Tạm được', 'Mạnh', 'Rất mạnh'] as const;

/** Đánh giá nhanh độ mạnh để gợi ý khi gõ (máy chủ vẫn kiểm tra theo newPasswordSchema). */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { score: 0, label: LABELS[0] };
  let score = 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 14) score += 1;
  const s = Math.min(score, 4) as PasswordStrength['score'];
  return { score: s, label: LABELS[s] };
}
