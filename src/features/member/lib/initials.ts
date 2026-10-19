/** "Nguyễn Văn An" → "NA" (chữ đầu họ + chữ đầu tên) cho ảnh đại diện chữ. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts.at(-1) ?? '';
  const first = parts.length > 1 ? (parts[0] ?? '') : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'R';
}
