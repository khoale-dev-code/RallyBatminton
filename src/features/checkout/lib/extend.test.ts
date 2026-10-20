import { describe, expect, it } from 'vitest';

import { overtimeMinutes, suggestedOption } from './extend';

const at = (hhmm: string) => `2026-10-20T${hhmm}:00+07:00`;
const opts = [
  { minutes: 30, ends_at: at('19:30'), amount: 45000 },
  { minutes: 60, ends_at: at('20:00'), amount: 90000 },
  { minutes: 90, ends_at: at('20:30'), amount: 135000 },
];
const now = (hhmm: string) => new Date(at(hhmm)).getTime();

describe('khách chơi thêm giờ', () => {
  it('đếm phút quá giờ', () => {
    expect(overtimeMinutes(at('19:00'), now('18:50'))).toBe(0);
    expect(overtimeMinutes(at('19:00'), now('19:25'))).toBe(25);
  });

  it('gợi ý khung phủ tới hiện tại, bỏ qua vài phút dọn sân', () => {
    expect(suggestedOption(opts, at('19:00'), now('19:08'))).toBeNull();
    expect(suggestedOption(opts, at('19:00'), now('19:25'))?.minutes).toBe(30);
    // Đặt 18–19h, chơi tới 20:05 → tính tới 20:00 (lố 5 phút trong ân hạn)
    expect(suggestedOption(opts, at('19:00'), now('20:05'))?.minutes).toBe(60);
    expect(suggestedOption(opts, at('19:00'), now('20:15'))?.minutes).toBe(90);
    // Quá cả khung trống → lấy khung dài nhất có thể
    expect(suggestedOption(opts, at('19:00'), now('22:00'))?.minutes).toBe(90);
  });
});
