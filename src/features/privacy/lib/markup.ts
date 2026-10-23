/**
 * Cú pháp gọn cho văn bản pháp lý chủ sân tự sửa (không có HTML → không chèn được mã độc):
 *   ## Tiêu đề mục        ### Tiêu đề phụ
 *   - gạch đầu dòng       1. đánh số
 *   | bảng | ... |        (dòng thứ hai `| --- |` là đường kẻ dưới hàng tiêu đề)
 *   > ghi chú nổi bật
 *   {{bang_huy_coc}}      khối dữ liệu tự sinh (đứng riêng một dòng)
 *   {{hotline}}           giá trị chèn trong câu
 * Trong câu dùng **đậm** và [liên kết](/trong-web) như nội dung Cẩm nang.
 */
export type LegalBlock =
  | { kind: 'h2'; text: string; id: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'slot'; key: string };

const SLOT_LINE = /^\{\{\s*([a-z_]+)\s*\}\}$/;
const TABLE_SEP = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

/** Mã neo (#) cho tiêu đề mục: bỏ dấu tiếng Việt, chữ thường, gạch nối. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function parseLegalMarkup(source: string): LegalBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: LegalBlock[] = [];
  const usedIds = new Set<string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      i += 1;
      continue;
    }
    const slot = SLOT_LINE.exec(line);
    if (slot) {
      blocks.push({ kind: 'slot', key: slot[1] });
      i += 1;
    } else if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4).trim() });
      i += 1;
    } else if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      let id = slugify(text) || 'muc';
      for (let n = 2; usedIds.has(id); n += 1) id = `${slugify(text)}-${n}`;
      usedIds.add(id);
      blocks.push({ kind: 'h2', text, id });
      i += 1;
    } else if (line.startsWith('> ')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) parts.push(lines[i++].trim().slice(2).trim());
      blocks.push({ kind: 'note', text: parts.join(' ') });
    } else if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) items.push(lines[i++].trim().slice(2).trim());
      blocks.push({ kind: 'ul', items });
    } else if (/^\d+[.)] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)] /.test(lines[i].trim()))
        items.push(
          lines[i++]
            .trim()
            .replace(/^\d+[.)] /, '')
            .trim(),
        );
      blocks.push({ kind: 'ol', items });
    } else if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i++].trim();
        if (!TABLE_SEP.test(row)) rows.push(cells(row));
      }
      const [head = [], ...body] = rows;
      blocks.push({ kind: 'table', head, rows: body.map((r) => head.map((_, c) => r[c] ?? '')) });
    } else {
      const parts: string[] = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === '' || /^(#{2,3} |> |[-*] |\d+[.)] |\|)/.test(next) || SLOT_LINE.test(next)) break;
        parts.push(next);
        i += 1;
      }
      blocks.push({ kind: 'p', text: parts.join(' ') });
    }
  }
  return blocks;
}

/** Thay {{khoa}} trong câu bằng giá trị; thiếu giá trị → "(chưa cập nhật)". */
export function fillPlaceholders(text: string, values: Readonly<Record<string, string | null | undefined>>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    return v && v.trim() ? v.trim() : '(chưa cập nhật)';
  });
}

/** Các khóa {{...}} được hỗ trợ — hiển thị trong trình soạn thảo cho chủ sân. */
export const INLINE_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: 'ten_thuong_hieu', label: 'Tên thương hiệu' },
  { key: 'ten_phap_ly', label: 'Tên doanh nghiệp / hộ kinh doanh' },
  { key: 'ma_so_thue', label: 'Mã số thuế' },
  { key: 'dia_chi', label: 'Địa chỉ pháp lý' },
  { key: 'hotline', label: 'Hotline' },
  { key: 'email', label: 'Email liên hệ' },
  { key: 'email_du_lieu', label: 'Email về dữ liệu cá nhân' },
  { key: 'nguoi_phu_trach', label: 'Đầu mối bảo vệ dữ liệu' },
];

export const BLOCK_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: 'bang_huy_coc', label: 'Bảng giữ chỗ / cọc / hoàn cọc của từng chi nhánh (đọc từ cấu hình)' },
  { key: 'bang_luu_tru', label: 'Bảng thời hạn lưu trữ (đọc từ Quản trị → Dữ liệu cá nhân)' },
];

/** Những khóa lạ trong văn bản (gõ sai) — báo cho chủ sân trước khi đăng. */
export function unknownPlaceholders(source: string): string[] {
  const known = new Set([...INLINE_PLACEHOLDERS, ...BLOCK_PLACEHOLDERS].map((p) => p.key));
  const found = new Set<string>();
  for (const m of source.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) if (!known.has(m[1])) found.add(m[1]);
  return [...found];
}
