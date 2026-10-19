/** Chuẩn hóa SĐT di động VN về 0xxxxxxxxx — khớp với private.normalize_vn_phone trong database. */
export function normalizeVnPhone(input: string): string | null {
  let v = input.replace(/[\s.\-()]/g, '');
  if (v.startsWith('+84')) v = `0${v.slice(3)}`;
  else if (/^84[35789]\d{8}$/.test(v)) v = `0${v.slice(2)}`;
  return /^0[35789]\d{8}$/.test(v) ? v : null;
}

/** 0912345678 → +84912345678 (định dạng E.164 cho bí danh đăng nhập) */
export function toE164(localPhone: string): string {
  return `+84${localPhone.slice(1)}`;
}
