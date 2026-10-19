import { describe, expect, it } from 'vitest';

import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('bọc dấu ngoặc khi có dấu phẩy/ngoặc kép', () => {
    expect(csvCell('Nguyễn, An')).toBe('"Nguyễn, An"');
    expect(csvCell('Ghi "chú"')).toBe('"Ghi ""chú"""');
  });
  it('chặn công thức Excel', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
  });
  it('có BOM và CRLF', () => {
    const out = toCsv(['Mã', 'Lương'], [['NV001', 1500000]]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('\r\nNV001,1500000\r\n');
  });
});
