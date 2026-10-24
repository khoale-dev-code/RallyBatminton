import { describe, expect, it } from 'vitest';

import { cashCsv, revenueCsv } from './csv';

describe('xuất báo cáo CSV', () => {
  it('một BOM ở đầu, các bảng cách nhau dòng trống, hình thức thanh toán có nhãn tiếng Việt', () => {
    const csv = revenueCsv({
      from: '2026-10-01',
      to: '2026-10-02',
      days: 2,
      charge: 300,
      refund: 50,
      net: 250,
      count: 3,
      prev_net: 100,
      by_source: { booking: 200, sale: 50, rental: 0 },
      by_method: { cash: 150, bank_transfer: 100 },
      series: [
        { day: '2026-10-01', booking: 200, sale: 0, rental: 0, refund: 50 },
        { day: '2026-10-02', booking: 0, sale: 100, rental: 0, refund: 0 },
      ],
      by_branch: [{ id: 'b', name: 'Rally Quận 7', booking: 200, sale: 50, rental: 0, net: 250 }],
      by_court: [{ id: 'c', name: 'Sân A', branch: 'Rally Quận 7', net: 200 }],
    });
    expect(csv.startsWith('﻿Chỉ số,Giá trị')).toBe(true);
    expect(csv.match(/﻿/g)).toHaveLength(1);
    expect(csv).toContain('Hình thức: Tiền mặt,150');
    expect(csv).toContain('2026-10-01,200,0,0,50,150');
    expect(csv).toContain('\r\n\r\nChi nhánh,Tiền sân');
  });

  it('chặn chèn công thức từ dữ liệu người dùng (tên thu ngân, ghi chú)', () => {
    const csv = cashCsv({
      from: '2026-10-01',
      to: '2026-10-01',
      days: 1,
      cash_in: 0,
      cash_refund: 0,
      cash_net: 0,
      non_cash_net: 0,
      drawer: { total: 1, manual: 1, sale: 0, booking_payment: 0, rental: 0 },
      offline_sales: 0,
      offline_total: 0,
      by_day: [],
      by_cashier: [],
      shifts: [],
      manual_opens: [{ at: '2026-10-01T10:00:00Z', name: '=HYPERLINK("x")', branch: 'Q7', ref: '+1', device: null }],
    });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(",'+1,");
  });
});
