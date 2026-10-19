/** Khóa chống gửi trùng cho mỗi lần hiển thị form (gửi lại cùng form → database trả kết quả cũ). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
