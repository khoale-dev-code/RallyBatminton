import { describe, expect, it } from 'vitest';

import { changedFieldLabels, describeReason, recordTitle, statusChange } from './describe';

describe('diễn giải nhật ký', () => {
  it('lý do kỹ thuật → câu dễ hiểu', () => {
    expect(describeReason('system: auto complete')).toBe('Tự động hoàn tất khi hết giờ chơi');
    expect(describeReason('system: sepay 401406956')).toBe('SePay báo tiền về (giao dịch 401406956)');
    expect(describeReason('extend: +30 phút · Thu tiền tại quầy')).toBe('Gia hạn thêm 30 phút · Thu tiền tại quầy');
    expect(describeReason('Khách gọi đổi giờ')).toBe('Khách gọi đổi giờ');
    expect(describeReason(null)).toBeNull();
  });

  it('trạng thái đơn đổi → nhãn tiếng Việt; bỏ cột kỹ thuật', () => {
    const before = { status: 'checked_in', completed_at: null, status_changed_at: 'a', updated_at: 'x' };
    const after = { status: 'completed', completed_at: '2026-10-20', status_changed_at: 'b', updated_at: 'y' };
    expect(statusChange('bookings', before, after)).toEqual({ from: 'Đã đến sân', to: 'Hoàn tất' });
    expect(changedFieldLabels(before, after)).toEqual(['Trạng thái', 'Giờ hoàn tất']);
  });

  it('tên bản ghi + link chi tiết (không link khi đã xóa)', () => {
    expect(recordTitle('bookings', 'id1', null, { code: 'RB-ABC' }, 'UPDATE')).toEqual({ title: 'RB-ABC', href: '/admin/bookings/id1' });
    expect(recordTitle('customers', 'id2', { full_name: 'An' }, null, 'DELETE')).toEqual({ title: 'An', href: null });
  });
});
