/**
 * Nội dung CHÍNH XÁC của các ô xác nhận / đồng ý. Máy chủ lưu đúng câu này làm bằng chứng
 * (không nhận câu chữ từ trình duyệt — tránh bị sửa). Đổi câu chữ ở đây là đổi bằng chứng cho các lần sau.
 */
export const CONSENT_TEXT = {
  bookingTerms:
    'Tôi đồng ý với Điều khoản đặt sân, Chính sách hủy sân & hoàn cọc và xác nhận đã được cung cấp Chính sách bảo vệ dữ liệu cá nhân của Rally.',
  accountTerms: 'Tôi đồng ý với Điều khoản sử dụng và xác nhận đã được cung cấp Chính sách bảo vệ dữ liệu cá nhân của Rally.',
  marketing: 'Tôi muốn nhận tin khuyến mãi và ưu đãi từ Rally qua điện thoại, tin nhắn hoặc email. (Không bắt buộc)',
  marketingAccount: 'Nhận tin khuyến mãi và ưu đãi dành cho thành viên Rally',
  accountTermsGoogle:
    'Tiếp tục với Google nghĩa là tôi đồng ý với Điều khoản sử dụng và xác nhận đã được cung cấp Chính sách bảo vệ dữ liệu cá nhân của Rally.',
} as const;

/** Tên văn bản xuất hiện trong câu xác nhận → đường dẫn (để hiện thành liên kết, câu chữ vẫn y nguyên). */
export const CONSENT_LINKS: Array<[phrase: string, href: string]> = [
  ['Điều khoản đặt sân', '/legal/dieu-khoan'],
  ['Điều khoản sử dụng', '/legal/dieu-khoan'],
  ['Chính sách hủy sân & hoàn cọc', '/legal/huy-san'],
  ['Chính sách bảo vệ dữ liệu cá nhân', '/legal/bao-mat'],
];

/** Tách câu thành đoạn chữ / liên kết; nối các đoạn lại luôn ra đúng câu gốc. */
export function linkifyConsent(
  text: string,
  links: ReadonlyArray<readonly [string, string]> = CONSENT_LINKS,
): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { at: number; phrase: string; href: string } | null = null;
    for (const [phrase, href] of links) {
      const at = rest.indexOf(phrase);
      if (at >= 0 && (best === null || at < best.at)) best = { at, phrase, href };
    }
    if (!best) {
      parts.push({ text: rest });
      break;
    }
    if (best.at > 0) parts.push({ text: rest.slice(0, best.at) });
    parts.push({ text: best.phrase, href: best.href });
    rest = rest.slice(best.at + best.phrase.length);
  }
  return parts;
}

/** Đường dẫn công khai của từng văn bản. */
export const LEGAL_PAGES = {
  privacy: { slug: 'bao-mat', label: 'Chính sách bảo vệ dữ liệu cá nhân', short: 'Bảo vệ dữ liệu' },
  terms: { slug: 'dieu-khoan', label: 'Điều khoản sử dụng và đặt sân', short: 'Điều khoản' },
  cancellation: { slug: 'huy-san', label: 'Chính sách hủy sân và hoàn cọc', short: 'Hủy sân & hoàn cọc' },
  cookies: { slug: 'cookie', label: 'Chính sách cookie', short: 'Cookie' },
} as const;

export type LegalCode = keyof typeof LEGAL_PAGES;

export const LEGAL_CODES = Object.keys(LEGAL_PAGES) as LegalCode[];

export const legalHref = (code: LegalCode): string => `/legal/${LEGAL_PAGES[code].slug}`;

export function legalCodeFromSlug(slug: string): LegalCode | null {
  return LEGAL_CODES.find((c) => LEGAL_PAGES[c].slug === slug) ?? null;
}

export const DATA_REQUEST_HREF = '/legal/yeu-cau-du-lieu';
