import { z } from 'zod';

import { toast } from '@/components/ui/toast';
import { type CashDrawerTrigger } from '@/lib/labels';

import { logCashDrawerAction } from './actions';
import { callDesktop, isDesktopApp } from './bridge';
import { desktopDeviceLabel, desktopErrorText, shouldAutoOpenDrawer, shouldUsePrintDialog } from './lib/desktop';
import { loadDesktopState } from './store';

const done = z.null();

/**
 * In phần @media print của trang đang mở.
 *  - Rally Manager cho Windows đã chọn máy in hóa đơn → in thẳng, không hộp thoại.
 *  - Trình duyệt / chưa chọn máy in → hộp thoại in như trước.
 */
export async function printPage(): Promise<void> {
  if (!isDesktopApp()) {
    window.print();
    return;
  }
  const res = await callDesktop('print_page', done);
  if (res.ok) {
    toast.success('Đã gửi lệnh in.');
    return;
  }
  if (shouldUsePrintDialog(res.error.code)) {
    window.print();
    return;
  }
  toast.error(desktopErrorText(res.error));
}

/**
 * Mở ngăn kéo tiền (chỉ trong Rally Manager cho Windows, máy đã bật ngăn kéo). Luôn ghi nhật ký lên máy chủ trước;
 * mở bằng tay mà không ghi được nhật ký thì KHÔNG mở.
 */
export async function openCashDrawer(trigger: CashDrawerTrigger, refCode?: string): Promise<boolean> {
  const state = await loadDesktopState();
  if (state.status !== 'desktop') return false;
  if (!state.settings?.drawerEnabled) {
    if (trigger === 'manual') toast.error(desktopErrorText({ code: 'NO_DRAWER', message: '' }));
    return false;
  }
  const log = await logCashDrawerAction({ trigger, refCode, device: desktopDeviceLabel(state.info) });
  if (!log.ok) {
    toast.error(log.error);
    if (trigger === 'manual') return false;
  }
  const res = await callDesktop('open_cash_drawer', done);
  if (!res.ok) {
    if (res.error.code !== 'DRAWER_BUSY') toast.error(desktopErrorText(res.error));
    return false;
  }
  return true;
}

/** Sau khi thu tiền: tự mở ngăn kéo nếu là tiền mặt và máy đã bật tự mở. Không làm gì trên trình duyệt thường. */
export async function openDrawerAfterPayment(paymentMethod: string, trigger: CashDrawerTrigger, refCode?: string): Promise<void> {
  if (!isDesktopApp()) return;
  const state = await loadDesktopState();
  if (state.status !== 'desktop' || !shouldAutoOpenDrawer(state.settings, paymentMethod)) return;
  await openCashDrawer(trigger, refCode);
}
