import { z } from 'zod';

/** Ngưỡng chống lạm dụng chủ sân chỉnh được (giới hạn khớp ràng buộc trong 23_security_hardening.sql). */
export const LIMIT_FIELDS = [
  { key: 'client_max_active_holds', label: 'Lượt giữ chưa thanh toán cùng lúc / thiết bị', min: 1, max: 50, group: 'device' },
  { key: 'client_max_holds_per_hour', label: 'Lượt giữ mỗi giờ / thiết bị', min: 1, max: 100, group: 'device' },
  { key: 'client_max_phones_per_day', label: 'Số điện thoại khác nhau mỗi ngày / thiết bị', min: 1, max: 50, group: 'device' },
  { key: 'abandon_window_days', label: 'Xét số lần “giữ rồi bỏ” trong (ngày)', min: 1, max: 30, group: 'phone' },
  { key: 'phone_elevated_after', label: 'Bỏ từ … lần: chỉ giữ 1 lượt, thời gian giữ ngắn', min: 1, max: 20, group: 'phone' },
  { key: 'elevated_hold_minutes', label: 'Thời gian giữ khi bị giới hạn (phút)', min: 5, max: 30, group: 'phone' },
  { key: 'phone_block_after', label: 'Bỏ từ … lần: tạm chặn giữ online', min: 2, max: 50, group: 'phone' },
  { key: 'hold_cap_per_court', label: 'Lượt giữ chờ thanh toán tối đa / sân (0 = tắt)', min: 0, max: 20, group: 'branch' },
  { key: 'hold_cap_min', label: 'Tối thiểu mỗi chi nhánh', min: 1, max: 200, group: 'branch' },
  { key: 'login_max_failures', label: 'Sai mật khẩu … lần thì khóa', min: 3, max: 20, group: 'login' },
  { key: 'login_lock_minutes', label: 'Thời gian khóa (phút)', min: 5, max: 1440, group: 'login' },
  { key: 'login_ip_max_failures', label: 'Một mạng sai … lần / 15 phút thì khóa mạng đó', min: 10, max: 500, group: 'login' },
] as const;

export type LimitKey = (typeof LIMIT_FIELDS)[number]['key'];

export const LIMIT_GROUPS: Array<{ key: (typeof LIMIT_FIELDS)[number]['group']; title: string; hint: string }> = [
  {
    key: 'device',
    title: 'Theo thiết bị / mạng',
    hint: 'Nhận diện bằng mã băm địa chỉ mạng (không lưu IP thật). Đặt rộng tay nếu nhiều khách dùng chung Wi-Fi quán.',
  },
  {
    key: 'phone',
    title: 'Theo số điện thoại',
    hint: '“Giữ rồi bỏ” = giữ sân nhưng để hết hạn, không chuyển cọc. Hủy chủ động không bị tính. Tự hết sau số ngày ở trên.',
  },
  {
    key: 'branch',
    title: 'Sức chứa chi nhánh',
    hint: 'Chặn việc chiếm hết giờ trống bằng nhiều số điện thoại / nhiều mạng. Khách “Tin cậy” không bị tính.',
  },
  { key: 'login', title: 'Đăng nhập', hint: 'Áp dụng cho đăng nhập quản trị và tài khoản thành viên.' },
];

const limitShape = Object.fromEntries(
  LIMIT_FIELDS.map((f) => [
    f.key,
    z.coerce.number({ message: 'Nhập số' }).int('Nhập số nguyên').min(f.min, `Tối thiểu ${f.min}`).max(f.max, `Tối đa ${f.max}`),
  ]),
) as Record<LimitKey, z.ZodNumber>;

export const limitsSchema = z.object(limitShape).refine((v) => v.phone_block_after > v.phone_elevated_after, {
  message: 'Mức chặn phải lớn hơn mức giới hạn',
  path: ['phone_block_after'],
});
export type LimitsInput = z.infer<typeof limitsSchema>;

export const pauseSchema = z.object({
  paused: z.enum(['on', 'off']),
  message: z
    .string()
    .trim()
    .max(300, 'Tối đa 300 ký tự')
    .optional()
    .transform((v) => (v ? v : null)),
});

export const mfaPolicySchema = z.object({
  require_owner_mfa: z.boolean(),
  require_staff_mfa: z.boolean(),
});

/** Mã 6 số từ ứng dụng xác thực (bỏ khoảng trắng người dùng gõ thêm). */
export const totpCodeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Nhập đúng 6 chữ số trong ứng dụng xác thực'));

/** "Còn bị khóa X phút" cho người dùng. */
export function lockMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`;
}
