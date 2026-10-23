import { describe, expect, it } from 'vitest';

import { findGuide, GUIDES, nextGuide, type GuideBlock } from '../content';
import { COURT, NET_X, playArea, serveSide, serviceBoxes } from './court';
import { readingMinutes } from './reading';
import { parseRich, plainText } from './rich';

describe('parseRich', () => {
  it('tách chữ đậm và liên kết nội bộ', () => {
    expect(parseRich('Cầm **lỏng** rồi [thuê vợt](/rentals) nhé')).toEqual([
      { kind: 'text', text: 'Cầm ' },
      { kind: 'bold', text: 'lỏng' },
      { kind: 'text', text: ' rồi ' },
      { kind: 'link', text: 'thuê vợt', href: '/rentals' },
      { kind: 'text', text: ' nhé' },
    ]);
  });

  it('không tạo liên kết ra ngoài web', () => {
    expect(parseRich('[x](https://evil.example)')).toEqual([{ kind: 'text', text: '[x](https://evil.example)' }]);
    expect(plainText('a **b** [c](/d)')).toBe('a b c');
  });
});

describe('sơ đồ sân', () => {
  it('điểm chẵn giao bên phải, lẻ bên trái', () => {
    expect(serveSide(0)).toBe('right');
    expect(serveSide(7)).toBe('left');
  });

  it('ô giao đơn hẹp & dài, ô giao đôi rộng & ngắn', () => {
    const s = serviceBoxes('serve-singles', 0);
    expect(s.target.x + s.target.w).toBeCloseTo(COURT.length);
    expect(s.target.h).toBeCloseTo(COURT.width / 2 - COURT.sideAlley);
    const d = serviceBoxes('serve-doubles', 0);
    expect(d.target.x + d.target.w).toBeCloseTo(COURT.length - COURT.doublesLong);
    expect(d.target.h).toBeCloseTo(COURT.width / 2);
    expect(s.target.x).toBeCloseTo(NET_X + COURT.shortService);
  });

  it('người giao và ô nhận luôn chéo nhau', () => {
    for (const score of [0, 1, 2, 3]) {
      const { server, target } = serviceBoxes('serve-doubles', score);
      const serverLow = server.y >= COURT.width / 2 - 1e-9;
      const targetLow = target.y >= COURT.width / 2 - 1e-9;
      expect(serverLow).not.toBe(targetLow);
      expect(server.x + server.w).toBeLessThanOrEqual(NET_X);
      expect(target.x).toBeGreaterThanOrEqual(NET_X);
    }
  });

  it('đánh đơn bỏ hai hành lang bên', () => {
    expect(playArea('singles').h).toBeCloseTo(5.18);
    expect(playArea('doubles').h).toBeCloseTo(COURT.width);
  });
});

describe('nội dung cẩm nang', () => {
  const ROUTES = ['/booking', '/booking/lookup', '/branches', '/products', '/rentals', '/register'];
  const linksOf = (b: GuideBlock): string[] => {
    const texts =
      b.kind === 'text' || b.kind === 'heading'
        ? [b.text]
        : b.kind === 'note'
          ? [b.text]
          : b.kind === 'list'
            ? b.items.map((i) => i.text)
            : b.kind === 'steps' || b.kind === 'cards' || b.kind === 'faults'
              ? b.items.map((i) => i.text)
              : [];
    const hrefs = texts.flatMap((t) => parseRich(t).flatMap((p) => (p.kind === 'link' ? [p.href] : [])));
    return b.kind === 'actions' ? [...hrefs, ...b.items.map((i) => i.href)] : hrefs;
  };

  it('slug duy nhất, tra được, bài kế tiếp vòng lại', () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    expect(findGuide('luat-choi')?.title).toBe('Luật chơi cơ bản');
    expect(nextGuide(GUIDES[GUIDES.length - 1].slug).slug).toBe(GUIDES[0].slug);
  });

  it('mọi liên kết trong bài trỏ tới trang có thật', () => {
    for (const g of GUIDES) for (const b of g.blocks) for (const href of linksOf(b)) expect(ROUTES).toContain(href);
  });

  it('thời gian đọc hợp lý', () => {
    for (const g of GUIDES) {
      const m = readingMinutes(g);
      expect(m).toBeGreaterThanOrEqual(2);
      expect(m).toBeLessThanOrEqual(10);
    }
  });
});
