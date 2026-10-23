import { type Guide, type GuideBlock } from '../content';
import { plainText } from './rich';

function blockTexts(b: GuideBlock): string[] {
  switch (b.kind) {
    case 'text':
    case 'heading':
      return [b.text];
    case 'list':
      return b.items.flatMap((i) => [i.term ?? '', i.text]);
    case 'steps':
    case 'cards':
      return b.items.flatMap((i) => [i.title, i.text]);
    case 'faults':
      return b.items.flatMap((i) => [i.title, i.text, i.allowed ?? '']);
    case 'note':
      return [b.title, b.text];
    case 'scoreboard':
    case 'court':
    case 'actions':
      return [];
  }
}

/** Số chữ (từ) của bài, tính cả đoạn mở đầu. */
export function wordCount(guide: Guide): number {
  const text = [guide.lead, ...guide.blocks.flatMap(blockTexts)].map(plainText).join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** Phút đọc (khoảng 200 từ/phút tiếng Việt, cộng 1 phút cho mỗi hình tương tác), tối thiểu 2. */
export function readingMinutes(guide: Guide): number {
  const interactive = guide.blocks.filter((b) => b.kind === 'court' || b.kind === 'scoreboard').length;
  return Math.max(2, Math.round(wordCount(guide) / 200) + interactive);
}
