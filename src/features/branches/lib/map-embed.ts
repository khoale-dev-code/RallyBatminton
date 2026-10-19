/**
 * Bản đồ Google nhúng cho từng chi nhánh.
 * Chủ sân dán NGUYÊN mã <iframe …> (Google Maps → Chia sẻ → Nhúng bản đồ) hoặc chỉ đường link src.
 * Chỉ chấp nhận https://www.google.com/maps/embed?pb=… — không cho nhúng trang bất kỳ.
 */
export const MAP_EMBED_PATTERN = /^https:\/\/www\.google\.com\/maps\/embed\?pb=[^\s"'<>]+$/;
export const MAP_EMBED_MAX = 2000;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"');
}

export type MapEmbedParse = { ok: true; url: string | null } | { ok: false; error: string };

/** Ô trống → null (xóa bản đồ riêng, dùng bản đồ theo địa chỉ). */
export function parseMapEmbed(input: string | null | undefined): MapEmbedParse {
  const raw = (input ?? '').trim();
  if (raw === '') return { ok: true, url: null };
  const fromIframe = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1];
  const url = decodeEntities((fromIframe ?? raw).trim());
  if (url.length > MAP_EMBED_MAX) return { ok: false, error: 'Mã nhúng quá dài.' };
  if (!MAP_EMBED_PATTERN.test(url)) {
    return {
      ok: false,
      error: 'Chỉ nhận mã nhúng Google Maps (Google Maps → Chia sẻ → Nhúng bản đồ → Sao chép HTML).',
    };
  }
  return { ok: true, url };
}

/** Link nhúng dùng để hiển thị: link riêng của chi nhánh, hoặc tìm theo địa chỉ (không cần API key). */
export function mapEmbedSrc(embedUrl: string | null | undefined, address: string): string {
  if (embedUrl && MAP_EMBED_PATTERN.test(embedUrl)) return embedUrl;
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&hl=vi&z=16&output=embed`;
}

/** Link mở Google Maps để chỉ đường. */
export function mapDirectionsHref(mapUrl: string | null | undefined, address: string): string {
  if (mapUrl && /^https:\/\//.test(mapUrl)) return mapUrl;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
