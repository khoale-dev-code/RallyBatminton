import { describe, expect, it } from 'vitest';

import { mapDirectionsHref, mapEmbedSrc, parseMapEmbed } from './map-embed';

const SRC =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3912.36!2d106.11!3d11.30!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x310b6b4f1b1a3691%3A0xc657ae9439f71d89!2zU8OibiBD!5e0!3m2!1svi!2s!4v1792378021927!5m2!1svi!2s';

describe('parseMapEmbed', () => {
  it('tách src từ nguyên mã iframe Google', () => {
    const html = `<iframe src="${SRC}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    expect(parseMapEmbed(html)).toEqual({ ok: true, url: SRC });
  });

  it('nhận link src trực tiếp và giải mã &amp;', () => {
    expect(parseMapEmbed(SRC.replace('!1m18', '!1m18&amp;x=1'))).toEqual({ ok: true, url: SRC.replace('!1m18', '!1m18&x=1') });
  });

  it('ô trống → xóa bản đồ riêng', () => {
    expect(parseMapEmbed('  ')).toEqual({ ok: true, url: null });
  });

  it('từ chối trang không phải bản đồ nhúng Google', () => {
    expect(parseMapEmbed('<iframe src="https://evil.example/maps/embed?pb=1"></iframe>').ok).toBe(false);
    expect(parseMapEmbed('https://www.google.com/maps/place/Rally').ok).toBe(false);
    expect(parseMapEmbed('javascript:alert(1)').ok).toBe(false);
    expect(parseMapEmbed('https://www.google.com/maps/embed?pb=1" onload="x').ok).toBe(false);
  });
});

describe('mapEmbedSrc', () => {
  it('dùng link riêng nếu hợp lệ, không thì tìm theo địa chỉ', () => {
    expect(mapEmbedSrc(SRC, 'x')).toBe(SRC);
    expect(mapEmbedSrc(null, '88 Nguyễn Thị Thập, Quận 7')).toBe(
      'https://www.google.com/maps?q=88%20Nguy%E1%BB%85n%20Th%E1%BB%8B%20Th%E1%BA%ADp%2C%20Qu%E1%BA%ADn%207&hl=vi&z=16&output=embed',
    );
    expect(mapEmbedSrc('https://evil.example', 'A')).toContain('google.com/maps?q=A');
  });
});

describe('mapDirectionsHref', () => {
  it('ưu tiên link Google Maps của chi nhánh', () => {
    expect(mapDirectionsHref('https://maps.app.goo.gl/abc', 'x')).toBe('https://maps.app.goo.gl/abc');
    expect(mapDirectionsHref(null, 'Rally Q7')).toBe('https://www.google.com/maps/dir/?api=1&destination=Rally%20Q7');
  });
});
