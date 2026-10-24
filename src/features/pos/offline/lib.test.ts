import { describe, expect, it } from 'vitest';

import { type PosItem } from '../lib/cart';
import {
  applyPendingStock,
  isRetryableSyncError,
  isTooOld,
  offlineCheckoutProblem,
  offlineReceiptCode,
  offlineSaleSchema,
  summarizePending,
  SendTimeoutError,
  syncOrder,
  withTimeout,
  type OfflineSale,
} from './lib';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const U1 = '33333333-3333-4333-8333-333333333333';
const U2 = '44444444-4444-4444-8444-444444444444';
const B1 = '55555555-5555-4555-8555-555555555555';
const B2 = '66666666-6666-4666-8666-666666666666';

function sale(p: Partial<OfflineSale>): OfflineSale {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000000',
    userId: U1,
    cashierName: 'Thu ngân',
    branchId: B1,
    branchName: 'Rally Quận 7',
    soldAt: '2026-10-24T03:00:00.000Z',
    lines: [
      {
        variantId: V1,
        unitId: null,
        quantity: 2,
        conversion: 1,
        name: 'Nước',
        variantLabel: null,
        unitName: 'chai',
        unitPrice: 10000,
        lineTotal: 20000,
      },
    ],
    discount: 0,
    total: 20000,
    tendered: 50000,
    note: null,
    drawerOpened: false,
    status: 'pending',
    error: null,
    acceptServerTotal: false,
    attempts: 0,
    ...p,
  };
}

const item = (p: Partial<PosItem>): PosItem => ({
  key: V1,
  variantId: V1,
  productId: 'p',
  name: 'Nước',
  variantLabel: null,
  price: 10000,
  onHand: 10,
  categoryId: null,
  cover: null,
  ...p,
});

describe('bán hàng khi mất mạng', () => {
  it('mã tạm trên phiếu', () => {
    expect(offlineReceiptCode('a1b2c3d4-0000-4000')).toBe('TAM-A1B2C3');
  });

  it('trừ tồn theo đơn chưa gửi của đúng chi nhánh, kể cả đơn vị quy đổi', () => {
    const items = [
      item({}),
      item({ key: `${V1}:thung`, unitId: 'thung', conversion: 6, baseOnHand: 10, onHand: 1 }),
      item({ key: V2, variantId: V2, onHand: 5 }),
    ];
    const sales = [
      sale({}),
      sale({ id: 'x2', lines: [{ ...sale({}).lines[0]!, quantity: 1, conversion: 6 }] }),
      sale({ id: 'x3', branchId: B2 }),
    ];
    const out = applyPendingStock(items, sales, B1);
    expect(out[0]).toMatchObject({ onHand: 2, baseOnHand: 2 });
    expect(out[1]).toMatchObject({ onHand: 0, baseOnHand: 2 });
    expect(out[2]).toBe(items[2]);
    expect(applyPendingStock(items, [], B1)).toBe(items);
    expect(applyPendingStock([item({ onHand: 1 })], [sale({})], B1)[0]?.onHand).toBe(0);
  });

  it('chỉ tiền mặt, không thông tin khách', () => {
    expect(offlineCheckoutProblem({ paymentMethod: 'cash' })).toBeNull();
    expect(offlineCheckoutProblem({ paymentMethod: 'bank_transfer' })).toMatch(/TIỀN MẶT/);
    expect(offlineCheckoutProblem({ paymentMethod: 'cash', customerPhone: '0912345678' })).toMatch(/thông tin khách/);
  });

  it('lỗi tạm thời giữ chờ gửi lại; lỗi nghiệp vụ cần xử lý', () => {
    expect(isRetryableSyncError(undefined)).toBe(true);
    expect(isRetryableSyncError('AUTH_REQUIRED')).toBe(true);
    expect(isRetryableSyncError('INSUFFICIENT_STOCK')).toBe(false);
    expect(isRetryableSyncError('OFFLINE_PRICE_CHANGED')).toBe(false);
  });

  it('gửi theo thứ tự giờ bán; tổng hợp theo tài khoản', () => {
    const a = sale({ id: 'b', soldAt: '2026-10-24T05:00:00.000Z' });
    const b = sale({ id: 'a', soldAt: '2026-10-24T04:00:00.000Z' });
    expect(syncOrder([a, b]).map((s) => s.id)).toEqual(['a', 'b']);
    const s = summarizePending([a, b, sale({ id: 'c', status: 'failed' }), sale({ id: 'd', userId: U2 })], U1);
    expect(s).toMatchObject({ pending: 2, pendingTotal: 40000, others: 1 });
    expect(s.failed.map((f) => f.id)).toEqual(['c']);
  });

  it('kiểm tra dữ liệu đọc từ máy và hạn 72 giờ', () => {
    expect(offlineSaleSchema.safeParse(sale({})).success).toBe(true);
    expect(offlineSaleSchema.safeParse({ ...sale({}), lines: [] }).success).toBe(false);
    expect(offlineSaleSchema.safeParse({ ...sale({}), status: 'done' }).success).toBe(false);
    const now = Date.parse('2026-10-24T03:00:00.000Z');
    expect(isTooOld(sale({ soldAt: '2026-10-21T02:00:00.000Z' }), now)).toBe(true);
    expect(isTooOld(sale({ soldAt: '2026-10-23T03:00:00.000Z' }), now)).toBe(false);
  });

  it('gửi bị treo → hết thời gian (an toàn nhờ mã chống trùng)', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20)).rejects.toBeInstanceOf(SendTimeoutError);
    await expect(withTimeout(Promise.resolve(7), 20)).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(new Error('mạng')), 20)).rejects.toThrow('mạng');
  });
});
