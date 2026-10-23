import { describe, expect, it } from 'vitest';

import { CONSENT_TEXT, linkifyConsent } from '../consent-text';
import { fillPlaceholders, parseLegalMarkup, slugify, unknownPlaceholders } from './markup';
import { refundAmount, refundTiers, requestDeadline, type CancellationPolicy } from './policy';

describe('parseLegalMarkup', () => {
  it('tách tiêu đề, đoạn, danh sách, bảng, khối tự sinh', () => {
    const blocks = parseLegalMarkup(
      [
        'Mở đầu dòng một',
        'nối dòng hai',
        '',
        '## 1. Dữ liệu',
        '- a',
        '- b',
        '1. một',
        '2. hai',
        '| Cột A | Cột B |',
        '| --- | --- |',
        '| x | y |',
        '| z |',
        '{{bang_huy_coc}}',
        '> Lưu ý quan trọng',
        '## 1. Dữ liệu',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'p', text: 'Mở đầu dòng một nối dòng hai' },
      { kind: 'h2', text: '1. Dữ liệu', id: '1-du-lieu' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', items: ['một', 'hai'] },
      {
        kind: 'table',
        head: ['Cột A', 'Cột B'],
        rows: [
          ['x', 'y'],
          ['z', ''],
        ],
      },
      { kind: 'slot', key: 'bang_huy_coc' },
      { kind: 'note', text: 'Lưu ý quan trọng' },
      { kind: 'h2', text: '1. Dữ liệu', id: '1-du-lieu-2' },
    ]);
  });

  it('không có cách nào sinh HTML', () => {
    const blocks = parseLegalMarkup('<script>alert(1)</script>');
    expect(blocks).toEqual([{ kind: 'p', text: '<script>alert(1)</script>' }]);
  });

  it('điền giá trị, thiếu thì báo chưa cập nhật, phát hiện khóa gõ sai', () => {
    expect(fillPlaceholders('Gọi {{hotline}} hoặc {{email}}', { hotline: '0901', email: ' ' })).toBe('Gọi 0901 hoặc (chưa cập nhật)');
    expect(unknownPlaceholders('{{hotline}} {{hot_line}} {{bang_luu_tru}}')).toEqual(['hot_line']);
    expect(slugify('Đầu mối bảo vệ dữ liệu')).toBe('dau-moi-bao-ve-du-lieu');
  });
});

describe('hoàn cọc', () => {
  const p: CancellationPolicy = {
    holdMinutes: 30,
    depositPercent: 10,
    freeCancelHours: 24,
    partialRefundHours: 6,
    partialRefundPercent: 50,
  };

  it('khớp công thức trong database', () => {
    expect(refundAmount(100_000, 30, p)).toBe(100_000);
    expect(refundAmount(100_000, 24, p)).toBe(100_000);
    expect(refundAmount(105_500, 10, p)).toBe(52_000);
    expect(refundAmount(100_000, 5.9, p)).toBe(0);
    expect(refundAmount(0, 48, p)).toBe(0);
  });

  it('bỏ mốc trùng khi hai ngưỡng bằng nhau', () => {
    expect(refundTiers(p).map((t) => t.percent)).toEqual([100, 50, 0]);
    expect(refundTiers({ ...p, partialRefundHours: 24 }).map((t) => t.percent)).toEqual([100, 0]);
  });
});

describe('hạn xử lý yêu cầu', () => {
  const now = Date.parse('2026-10-23T00:00:00Z');
  it('quá hạn / sắp hết hạn / đã gia hạn / đã đóng', () => {
    expect(requestDeadline({ due_at: '2026-10-22T00:00:00Z', extended_due_at: null, status: 'received' }, now).state).toBe('overdue');
    expect(requestDeadline({ due_at: '2026-10-24T12:00:00Z', extended_due_at: null, status: 'in_progress' }, now).state).toBe('soon');
    expect(
      requestDeadline({ due_at: '2026-10-22T00:00:00Z', extended_due_at: '2026-11-05T00:00:00Z', status: 'extended' }, now).state,
    ).toBe('ok');
    expect(requestDeadline({ due_at: '2026-10-01T00:00:00Z', extended_due_at: null, status: 'completed' }, now).state).toBe('closed');
  });
});

describe('câu xác nhận', () => {
  it('hiện liên kết nhưng nối lại vẫn đúng câu được lưu làm bằng chứng', () => {
    for (const text of Object.values(CONSENT_TEXT)) {
      expect(
        linkifyConsent(text)
          .map((p) => p.text)
          .join(''),
      ).toBe(text);
    }
    const parts = linkifyConsent(CONSENT_TEXT.bookingTerms);
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual(['/legal/dieu-khoan', '/legal/huy-san', '/legal/bao-mat']);
  });
});
