import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { verifySepayRequest } from './sepay';

vi.mock('server-only', () => ({}));
import { memoPrefixFor } from './bank-form';
import { amountsDue, transferContent, vietQrImageUrl } from './transfer';

const body = '{"id":1,"transferType":"in","transferAmount":42000,"content":"RB7K3M9Q2T"}';
const now = 1_760_860_000;
const sign = (secret: string, ts: number, raw = body) => `sha256=${createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')}`;
const base = { rawBody: body, authorization: null, signature: null, timestamp: null, secret: null, apiKey: null, nowSeconds: now };

describe('verifySepayRequest', () => {
  it('từ chối khi chưa cấu hình khóa', () => {
    expect(verifySepayRequest(base)).toBe('not_configured');
  });

  it('chấp nhận chữ ký HMAC đúng, từ chối sai / quá hạn / sửa nội dung', () => {
    const secret = 's3cret';
    expect(verifySepayRequest({ ...base, secret, signature: sign(secret, now), timestamp: String(now) })).toBe('ok');
    expect(verifySepayRequest({ ...base, secret, signature: sign('other', now), timestamp: String(now) })).toBe('unauthorized');
    expect(verifySepayRequest({ ...base, secret, signature: sign(secret, now - 900), timestamp: String(now - 900) })).toBe('unauthorized');
    expect(
      verifySepayRequest({
        ...base,
        rawBody: body.replace('42000', '420000'),
        secret,
        signature: sign(secret, now),
        timestamp: String(now),
      }),
    ).toBe('unauthorized');
  });

  it('chấp nhận API key đúng định dạng "Apikey …"', () => {
    expect(verifySepayRequest({ ...base, apiKey: 'KEY123', authorization: 'Apikey KEY123' })).toBe('ok');
    expect(verifySepayRequest({ ...base, apiKey: 'KEY123', authorization: 'apikey KEY123' })).toBe('ok');
    expect(verifySepayRequest({ ...base, apiKey: 'KEY123', authorization: 'Bearer KEY123' })).toBe('unauthorized');
    expect(verifySepayRequest({ ...base, apiKey: 'KEY123', authorization: 'Apikey KEY12' })).toBe('unauthorized');
  });
});

describe('chuyển khoản', () => {
  it('nội dung bỏ gạch, viết hoa; thêm chữ bắt buộc nếu có', () => {
    expect(transferContent('RB-7k3m9q2t')).toBe('RB7K3M9Q2T');
    expect(transferContent('RB-7K3M9Q2T', 'sevqr')).toBe('SEVQR RB7K3M9Q2T');
    expect(transferContent('RB-7K3M9Q2T', '')).toBe('RB7K3M9Q2T');
  });

  it('VietinBank tự thêm SEVQR khi để trống', () => {
    expect(memoPrefixFor('VietinBank', undefined)).toBe('SEVQR');
    expect(memoPrefixFor('970415', undefined)).toBe('SEVQR');
    expect(memoPrefixFor('MBBank', undefined)).toBeNull();
    expect(memoPrefixFor('MBBank', 'abc12')).toBe('ABC12');
    expect(memoPrefixFor(undefined, 'SEVQR')).toBeNull();
  });

  it('link VietQR có đủ tham số', () => {
    const url = new URL(vietQrImageUrl({ bankCode: 'MBBank', accountNo: '0123456789', accountName: null }, 42000, 'RB7K3M9Q2T'));
    expect(url.host).toBe('vietqr.app');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      acc: '0123456789',
      bank: 'MBBank',
      amount: '42000',
      des: 'RB7K3M9Q2T',
      template: 'compact',
    });
  });

  it('tính số tiền còn phải chuyển', () => {
    expect(amountsDue(140000, 42000, 0)).toEqual({ deposit: 42000, full: 140000 });
    expect(amountsDue(140000, 42000, 20000)).toEqual({ deposit: 22000, full: 120000 });
    expect(amountsDue(140000, 42000, 50000)).toEqual({ deposit: 0, full: 90000 });
    expect(amountsDue(140000, 42000, 140000)).toEqual({ deposit: 0, full: 0 });
  });
});

import { apiTransactionToPayload, sepayApiTransactionSchema, sepayDateTime } from './sepay-api';

describe('đối soát SePay API', () => {
  it('đổi giao dịch API sang dạng webhook', () => {
    const t = sepayApiTransactionSchema.parse({
      id: '92704',
      bank_brand_name: 'VietinBank',
      account_number: '101874131015',
      transaction_date: '2026-10-19 15:55:00',
      amount_out: '0.00',
      amount_in: '42000.00',
      accumulated: '1042000.00',
      transaction_content: 'SEVQR RBEX3BKN9K',
      reference_number: 'FT2629',
      code: null,
      sub_account: null,
    });
    expect(apiTransactionToPayload(t)).toMatchObject({
      id: 92704,
      transferType: 'in',
      transferAmount: 42000,
      content: 'SEVQR RBEX3BKN9K',
      referenceCode: 'FT2629',
      transactionDate: '2026-10-19 15:55:00',
      accountNumber: '101874131015',
    });
  });

  it('bỏ qua tiền ra', () => {
    const t = sepayApiTransactionSchema.parse({ id: 1, transaction_date: '2026-10-19 10:00:00', amount_in: '0.00', amount_out: '5000.00' });
    expect(apiTransactionToPayload(t)).toBeNull();
  });

  it('giờ Việt Nam đúng định dạng SePay', () => {
    expect(sepayDateTime(new Date('2026-10-19T08:55:07Z'))).toBe('2026-10-19 15:55:07');
  });
});
