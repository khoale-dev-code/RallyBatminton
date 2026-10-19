import { describe, expect, it } from 'vitest';

import { formatVnd } from '@/lib/format';

import { alertEmailHtml, alertHeadline, alertSubject, type AlertItem } from './alert-email';

const base: AlertItem = {
  id: '1',
  amount: 42000,
  content: 'SEVQR RBEX3BKN9K',
  status: 'review',
  status_note: 'Giữ chỗ đã hết hạn và giờ này đã có người khác đặt — cần liên hệ khách để đổi giờ hoặc hoàn tiền.',
  transaction_at: '2026-10-19T08:55:00+00:00',
  booking_code: 'RB-EX3BKN9K',
  contact_name: 'Nguyễn Văn A',
  contact_phone: '+84910015838',
  starts_at: '2026-10-20T12:30:00+00:00',
  court_name: 'Sân D',
  branch_name: 'Rally Quận 7',
};

describe('email cảnh báo giao dịch', () => {
  it('viết câu tóm tắt theo từng tình huống', () => {
    expect(alertHeadline(base)).toBe(`Khách Nguyễn Văn A chuyển ${formatVnd(42000)} nhưng giờ đã có người đặt — cần liên hệ khách`);
    expect(alertHeadline({ ...base, status_note: 'Đơn đã hủy / không đến nhưng khách vẫn chuyển tiền — cần hoàn tiền.' })).toContain(
      'đơn đã hủy',
    );
    expect(alertHeadline({ ...base, status: 'unmatched', booking_code: null, status_note: 'Nội dung không có mã đơn RB…' })).toBe(
      `Nhận ${formatVnd(42000)} nhưng nội dung chuyển khoản không có mã đơn — cần gán vào đơn hoặc hoàn tiền`,
    );
    expect(alertHeadline({ ...base, status: 'unmatched', booking_code: null, status_note: 'Không có đơn RBAAAAAAAA' })).toContain(
      'mã đơn trong nội dung không tồn tại',
    );
  });

  it('tiêu đề gộp khi nhiều giao dịch', () => {
    expect(alertSubject([base])).toMatch(/^\[Rally\] Khách Nguyễn Văn A/);
    expect(alertSubject([base, { ...base, id: '2' }])).toBe('[Rally] 2 giao dịch chuyển khoản cần xử lý');
  });

  it('thoát ký tự HTML trong nội dung khách gõ', () => {
    const html = alertEmailHtml([{ ...base, content: '<script>x</script>' }], 'https://rally.vn/admin/bank');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('tel:+84910015838');
  });
});
