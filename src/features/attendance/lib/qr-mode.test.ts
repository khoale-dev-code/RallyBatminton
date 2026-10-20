import { describe, expect, it } from 'vitest';

import { parseQrMode, parseScanEvent } from './qr-mode';

describe('loại mã QR chấm công', () => {
  it('màn hình quầy: mặc định cả hai mã', () => {
    expect(parseQrMode(undefined)).toBe('both');
    expect(parseQrMode('vao')).toBe('checkin');
    expect(parseQrMode('ra')).toBe('checkout');
    expect(parseQrMode('linh-tinh')).toBe('both');
  });
  it('mã quét: chỉ nhận checkin / checkout, mã cũ không có loại → null', () => {
    expect(parseScanEvent('checkin')).toBe('checkin');
    expect(parseScanEvent('checkout')).toBe('checkout');
    expect(parseScanEvent(undefined)).toBeNull();
    expect(parseScanEvent('delete')).toBeNull();
  });
});
