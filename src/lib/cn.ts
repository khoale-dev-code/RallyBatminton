/** Ghép className, bỏ qua giá trị rỗng. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
