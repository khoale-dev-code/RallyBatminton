import { z } from 'zod';

/**
 * Rally Manager cho Windows (Tauri): kiểu dữ liệu + thông báo lỗi của các lệnh máy quầy.
 * Ứng dụng Windows chỉ cho trang trên máy chủ Rally gọi ĐÚNG các lệnh dưới đây (desktop/src-tauri/src/lib.rs).
 */

export const DESKTOP_COMMANDS = [
  'desktop_info',
  'list_printers',
  'get_printer_settings',
  'save_printer_settings',
  'print_page',
  'open_cash_drawer',
] as const;
export type DesktopCommand = (typeof DESKTOP_COMMANDS)[number];

export const desktopInfoSchema = z.object({
  appVersion: z.string().max(40),
  platform: z.string().max(40),
  silentPrint: z.boolean(),
});
export type DesktopInfo = z.infer<typeof desktopInfoSchema>;

export const printerListSchema = z.array(z.object({ name: z.string().max(256), isDefault: z.boolean() })).max(200);
export type PrinterInfo = z.infer<typeof printerListSchema>[number];

export const printerSettingsSchema = z.object({
  receiptPrinter: z.string().max(256).nullable(),
  copies: z.number().int().min(1).max(3),
  drawerEnabled: z.boolean(),
  drawerPrinter: z.string().max(256).nullable(),
  drawerPin: z.union([z.literal(0), z.literal(1)]),
  autoOpenDrawer: z.boolean(),
});
export type PrinterSettings = z.infer<typeof printerSettingsSchema>;

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  receiptPrinter: null,
  copies: 1,
  drawerEnabled: false,
  drawerPrinter: null,
  drawerPin: 0,
  autoOpenDrawer: true,
};

export interface DesktopError {
  code: string;
  message: string;
}

const commandErrorSchema = z.object({ code: z.string().max(40), message: z.string().max(500) });

const ERROR_TEXT: Record<string, string> = {
  NOT_DESKTOP: 'Chỉ dùng được trong ứng dụng Rally Manager cho Windows.',
  NO_PRINTER: 'Máy này chưa chọn máy in hóa đơn — vào Ứng dụng & thông báo → Máy in & ngăn kéo tiền.',
  NO_DRAWER: 'Máy này chưa bật ngăn kéo tiền — vào Ứng dụng & thông báo → Máy in & ngăn kéo tiền.',
  PRINTER_UNAVAILABLE: 'Máy in không sẵn sàng — kiểm tra nguồn, cáp, giấy rồi thử lại.',
  PRINT_BUSY: 'Đang in, chờ một chút.',
  DRAWER_BUSY: 'Ngăn kéo vừa mở.',
  NOT_ALLOWED: 'Trang này không được phép điều khiển máy in.',
  UNSUPPORTED: 'Máy này không hỗ trợ in trực tiếp.',
};

/** Lỗi trả về từ ứng dụng Windows: lệnh của Rally ({code, message}) hoặc chuỗi (bị chặn quyền, lỗi khác). */
export function toDesktopError(raw: unknown): DesktopError {
  const parsed = commandErrorSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : '';
  if (/not allowed/i.test(text)) return { code: 'NOT_ALLOWED', message: text.slice(0, 300) };
  return { code: 'DESKTOP_FAILED', message: text.slice(0, 300) || 'Lỗi không xác định' };
}

export function desktopErrorText(error: DesktopError): string {
  return ERROR_TEXT[error.code] ?? `Không thực hiện được: ${error.message}`;
}

/** Các lỗi mà khi in nên chuyển sang hộp thoại in như trình duyệt (vẫn in được, chỉ là không tự động). */
export function shouldUsePrintDialog(code: string): boolean {
  return code === 'NO_PRINTER' || code === 'UNSUPPORTED' || code === 'NOT_DESKTOP';
}

/** Tự mở ngăn kéo khi vừa thu TIỀN MẶT và máy đã bật tự mở. */
export function shouldAutoOpenDrawer(settings: PrinterSettings | null, paymentMethod: string): boolean {
  return paymentMethod === 'cash' && settings !== null && settings.drawerEnabled && settings.autoOpenDrawer;
}

/** Tên máy ghi vào nhật ký mở ngăn kéo. */
export function desktopDeviceLabel(info: DesktopInfo | null): string {
  return info ? `Rally Manager Windows ${info.appVersion}` : 'Rally Manager Windows';
}
