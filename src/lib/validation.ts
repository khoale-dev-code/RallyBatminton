import { z } from 'zod';

import { MANUAL_PAYMENT_METHODS } from '@/lib/labels';

import { normalizeVnPhone } from './phone';

z.config(z.locales.vi());

/** Ô trống → undefined (để field tùy chọn hoạt động với FormData). */
const emptyToUndefined = (value: unknown): unknown => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const zText = (label: string, min = 1, max = 200) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: `Vui lòng nhập ${label}` })
      .min(min, min <= 1 ? `Vui lòng nhập ${label}` : `${label} cần ít nhất ${min} ký tự`)
      .max(max, `${label} tối đa ${max} ký tự`),
  );

export const zOptionalText = (max = 500) => z.preprocess(emptyToUndefined, z.string().trim().max(max, `Tối đa ${max} ký tự`).optional());

export const zUuid = (label = 'mục') => z.uuid(`Vui lòng chọn ${label}`);

export const zOptionalUuid = () => z.preprocess(emptyToUndefined, z.uuid().optional());

/** "120.000" / "120 000" / "120000" → 120000 */
export const zMoney = (label: string, { min = 0, max = 1_000_000_000 } = {}) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? Number(v.replace(/[.\s,₫đ]/g, '')) : v),
    z
      .number({ error: `${label} phải là số` })
      .int(`${label} phải là số nguyên`)
      .min(min, `${label} tối thiểu ${min.toLocaleString('vi-VN')}`)
      .max(max, `${label} quá lớn`),
  );

export const zOptionalMoney = (label: string) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zMoney(label).optional());

export const zInt = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(min, `${label} tối thiểu ${min}`)
    .max(max, `${label} tối đa ${max}`);

export const zDateKey = (label = 'ngày') => z.iso.date(`Vui lòng chọn ${label} hợp lệ`);

export const zTime = (label = 'giờ') => z.string().regex(/^([01]\d|2[0-4]):[0-5]\d(:\d{2})?$/, `Vui lòng chọn ${label} hợp lệ`);

export const zCheckbox = () => z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const zVnPhone = () =>
  z.string({ error: 'Vui lòng nhập số điện thoại' }).transform((v, ctx) => {
    const phone = normalizeVnPhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Số di động Việt Nam không hợp lệ (ví dụ 0912 345 678)' });
      return z.NEVER;
    }
    return phone;
  });

export const zOptionalVnPhone = () => z.preprocess(emptyToUndefined, zVnPhone().optional());

/** Hình thức thu tiền nhân viên ghi tay (không gồm cổng thanh toán online). */
export const zManualPaymentMethod = () => z.enum(MANUAL_PAYMENT_METHODS, { error: 'Chọn hình thức thanh toán' });

export const zIdempotencyKey = () => z.string().min(8).max(100);

/** FormData → object (giá trị đơn); dùng formData.getAll() cho nhóm checkbox. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !(key in result)) result[key] = value;
  }
  return result;
}

export function formDataStrings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === 'string');
}
