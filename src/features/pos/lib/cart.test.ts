import { describe, expect, it } from 'vitest';

import {
  cartReducer,
  maxQuantity,
  cartTax,
  cashSuggestions,
  changeDue,
  filterItems,
  foldVietnamese,
  stockLevel,
  summarizeCart,
  type PosItem,
} from './cart';

const water: PosItem = {
  key: 'v1',
  variantId: 'v1',
  productId: 'p1',
  name: 'Nước suối',
  variantLabel: null,
  price: 10000,
  onHand: 2,
  categoryId: 'c1',
  cover: null,
};
const socks: PosItem = {
  key: 'v2',
  variantId: 'v2',
  productId: 'p2',
  name: 'Tất thể thao',
  variantLabel: 'Size M',
  price: 45000,
  onHand: 5,
  categoryId: 'c2',
  cover: null,
};

describe('cartReducer', () => {
  it('cộng dồn khi thêm cùng món và không vượt tồn', () => {
    let lines = cartReducer([], { type: 'add', item: water, max: 2 });
    lines = cartReducer(lines, { type: 'add', item: water, max: 2 });
    lines = cartReducer(lines, { type: 'add', item: water, max: 2 });
    expect(lines).toEqual([{ key: 'v1', quantity: 2 }]);
  });

  it('không thêm món hết hàng', () => {
    expect(cartReducer([], { type: 'add', item: { ...water, onHand: 0 }, max: 0 })).toEqual([]);
  });

  it('đặt số lượng 0 thì bỏ dòng; vượt tồn thì kẹp lại', () => {
    const lines = [{ key: 'v2', quantity: 1 }];
    expect(cartReducer(lines, { type: 'set', key: 'v2', quantity: 9, max: 5 })).toEqual([{ key: 'v2', quantity: 5 }]);
    expect(cartReducer(lines, { type: 'set', key: 'v2', quantity: 0, max: 5 })).toEqual([]);
  });
});

describe('summarizeCart', () => {
  it('tính tạm tính và số món', () => {
    const map = new Map([water, socks].map((i) => [i.key, i]));
    const s = summarizeCart(
      [
        { key: 'v1', quantity: 2 },
        { key: 'v2', quantity: 1 },
      ],
      map,
    );
    expect(s.subtotal).toBe(65000);
    expect(s.itemCount).toBe(3);
  });
});

describe('filterItems', () => {
  it('tìm không dấu và lọc nhóm', () => {
    expect(foldVietnamese('Nước Đá')).toBe('nuoc da');
    expect(filterItems([water, socks], null, 'nuoc').map((i) => i.variantId)).toEqual(['v1']);
    expect(filterItems([water, socks], 'c2', '').map((i) => i.variantId)).toEqual(['v2']);
  });
});

describe('changeDue', () => {
  it('trả về tiền thối hoặc null khi đưa thiếu', () => {
    expect(changeDue(65000, 100000)).toBe(35000);
    expect(changeDue(65000, 50000)).toBeNull();
  });
});

describe('filterItems theo mã', () => {
  const coded: PosItem = { ...water, variantId: 'v9', codes: ['NUOC-AQUA-500', '8934588012345'] };
  it('quét đúng mã vạch trả đúng món, bỏ qua bộ lọc nhóm', () => {
    expect(filterItems([coded], 'c-khac', '8934588012345').map((i) => i.variantId)).toEqual(['v9']);
  });
  it('gõ một phần SKU vẫn tìm được', () => {
    expect(filterItems([coded], null, 'aqua').map((i) => i.variantId)).toEqual(['v9']);
  });
});

describe('quầy: tồn, thuế, tiền khách đưa', () => {
  it('mức tồn', () => {
    expect(stockLevel({ onHand: 0, reorderLevel: 5 })).toBe('out');
    expect(stockLevel({ onHand: 3, reorderLevel: 5 })).toBe('low');
    expect(stockLevel({ onHand: 3, reorderLevel: 0 })).toBe('ok');
  });
  it('VAT đã gồm trong giá, chia giảm giá theo tỷ lệ', () => {
    const taxed = { ...water, tax: { method: 'deduction' as const, vatRate: 8, pitRate: 0 } };
    const rows = [
      { lineTotal: 30000, item: taxed },
      { lineTotal: 10000, item: water },
    ];
    expect(cartTax(rows, 0)).toEqual({ vat: 2222, pit: 0, method: 'deduction' });
    expect(cartTax(rows, 20000).vat).toBe(1111);
  });
  it('gợi ý tiền mặt', () => {
    expect(cashSuggestions(45000)).toEqual([45000, 50000, 100000, 200000]);
    expect(cashSuggestions(100000)).toEqual([100000, 200000, 500000]);
    expect(cashSuggestions(0)).toEqual([]);
  });
});

describe('đơn vị quy đổi dùng chung tồn kho', () => {
  it('đã chọn 1 thùng 24 lon thì lon còn bán tối đa 6 (tồn 30)', () => {
    const can: PosItem = { ...water, key: 'v9', variantId: 'v9', onHand: 30, baseOnHand: 30, conversion: 1 };
    const crate: PosItem = { ...can, key: 'v9:u1', unitId: 'u1', unitName: 'Thùng', conversion: 24, onHand: 1, price: 450000 };
    const items = new Map([can, crate].map((i) => [i.key, i]));
    const lines = [{ key: 'v9:u1', quantity: 1 }];
    expect(maxQuantity(can, lines, items)).toBe(6);
    expect(maxQuantity(crate, [{ key: 'v9', quantity: 7 }], items)).toBe(0);
    expect(summarizeCart(lines, items).subtotal).toBe(450000);
  });
});
