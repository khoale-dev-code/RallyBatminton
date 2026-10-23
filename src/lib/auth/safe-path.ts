/** Chỉ cho phép chuyển hướng nội bộ trong khu quản trị (chống open redirect). */
export function safeAdminPath(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return '/admin';
}
