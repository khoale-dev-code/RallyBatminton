/** Một đoạn chữ trong nội dung cẩm nang: chữ thường, chữ đậm hoặc liên kết nội bộ. */
export type RichPart = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string };

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/**
 * Tách cú pháp gọn **đậm** và [chữ](/đường-dẫn). Chỉ nhận đường dẫn bắt đầu bằng "/" (trong web) —
 * nội dung không bao giờ sinh liên kết ra ngoài.
 */
export function parseRich(input: string): RichPart[] {
  const parts: RichPart[] = [];
  let last = 0;
  for (const m of input.matchAll(TOKEN)) {
    const at = m.index;
    if (at > last) parts.push({ kind: 'text', text: input.slice(last, at) });
    if (m[1] !== undefined) parts.push({ kind: 'bold', text: m[1] });
    else parts.push({ kind: 'link', text: m[2], href: m[3] });
    last = at + m[0].length;
  }
  if (last < input.length) parts.push({ kind: 'text', text: input.slice(last) });
  return parts;
}

/** Chữ thuần (bỏ cú pháp) — dùng đếm chữ và mô tả SEO. */
export const plainText = (input: string): string =>
  parseRich(input)
    .map((p) => p.text)
    .join('');
