import { describe, expect, it } from 'vitest';

import { isCashDrawerTrigger } from '@/lib/labels';

import {
  DEFAULT_PRINTER_SETTINGS,
  desktopDeviceLabel,
  desktopErrorText,
  printerSettingsSchema,
  shouldAutoOpenDrawer,
  shouldUsePrintDialog,
  toDesktopError,
} from './desktop';

describe('Rally Manager cho Windows', () => {
  it('đọc lỗi từ ứng dụng: lệnh Rally / bị chặn quyền / lỗi lạ', () => {
    expect(toDesktopError({ code: 'NO_PRINTER', message: 'x' })).toEqual({ code: 'NO_PRINTER', message: 'x' });
    expect(toDesktopError('open_cash_drawer not allowed on window "doc-1"').code).toBe('NOT_ALLOWED');
    expect(toDesktopError(new Error('boom'))).toEqual({ code: 'DESKTOP_FAILED', message: 'boom' });
    expect(toDesktopError(undefined).code).toBe('DESKTOP_FAILED');
    expect(desktopErrorText({ code: 'PRINTER_UNAVAILABLE', message: '' })).toMatch(/không sẵn sàng/);
    expect(desktopErrorText({ code: 'PRINT_FAILED', message: 'Hết giấy' })).toBe('Không thực hiện được: Hết giấy');
  });

  it('chưa chọn máy in / không phải ứng dụng → hộp thoại in; lỗi máy in → báo lỗi', () => {
    expect(shouldUsePrintDialog('NO_PRINTER')).toBe(true);
    expect(shouldUsePrintDialog('UNSUPPORTED')).toBe(true);
    expect(shouldUsePrintDialog('NOT_DESKTOP')).toBe(true);
    expect(shouldUsePrintDialog('PRINTER_UNAVAILABLE')).toBe(false);
  });

  it('chỉ tự mở ngăn kéo khi thu tiền mặt và máy đã bật', () => {
    const on = { ...DEFAULT_PRINTER_SETTINGS, receiptPrinter: 'XP-80C', drawerEnabled: true, autoOpenDrawer: true };
    expect(shouldAutoOpenDrawer(on, 'cash')).toBe(true);
    expect(shouldAutoOpenDrawer(on, 'bank_transfer')).toBe(false);
    expect(shouldAutoOpenDrawer({ ...on, autoOpenDrawer: false }, 'cash')).toBe(false);
    expect(shouldAutoOpenDrawer({ ...on, drawerEnabled: false }, 'cash')).toBe(false);
    expect(shouldAutoOpenDrawer(null, 'cash')).toBe(false);
  });

  it('kiểm tra cài đặt trả về từ ứng dụng', () => {
    expect(printerSettingsSchema.safeParse(DEFAULT_PRINTER_SETTINGS).success).toBe(true);
    expect(printerSettingsSchema.safeParse({ ...DEFAULT_PRINTER_SETTINGS, drawerPin: 2 }).success).toBe(false);
    expect(printerSettingsSchema.safeParse({ ...DEFAULT_PRINTER_SETTINGS, copies: 9 }).success).toBe(false);
    expect(desktopDeviceLabel({ appVersion: '1.0.0', platform: 'windows', silentPrint: true })).toBe('Rally Manager Windows 1.0.0');
    expect(desktopDeviceLabel(null)).toBe('Rally Manager Windows');
  });

  it('lý do mở ngăn kéo hợp lệ', () => {
    expect(isCashDrawerTrigger('sale')).toBe(true);
    expect(isCashDrawerTrigger('manual')).toBe(true);
    expect(isCashDrawerTrigger('hack')).toBe(false);
    expect(isCashDrawerTrigger(1)).toBe(false);
  });
});
