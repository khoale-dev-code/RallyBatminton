'use client';

import { Archive, Download, MonitorDown, Printer, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';

import { Button, buttonClass } from '@/components/ui/button';
import { controlClass } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { publicEnv } from '@/lib/env';
import { formatDateTime } from '@/lib/format';

import { callDesktop } from '../bridge';
import {
  DEFAULT_PRINTER_SETTINGS,
  desktopErrorText,
  printerListSchema,
  printerSettingsSchema,
  type DesktopInfo,
  type PrinterInfo,
  type PrinterSettings,
} from '../lib/desktop';
import { openCashDrawer, printPage } from '../print';
import { setDesktopSettings, useDesktopState } from '../store';

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-primary" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Phiếu in thử: chỉ hiện khi in (CSS @media print in phần .print-sheet). */
function TestSheet({ printer }: { printer: string | null }) {
  return (
    <div className="print-sheet hidden text-center print:block" aria-hidden>
      <p className="text-lg font-bold">RALLY MANAGER</p>
      <p>In thử máy in hóa đơn</p>
      <p>{printer ?? ''}</p>
      <p>{formatDateTime(new Date().toISOString())}</p>
      <p className="mt-2">Tiếng Việt có dấu: Đặt sân cầu lông — Ưu đãi</p>
      <p className="mt-2 border-t border-dashed border-ink pt-2">Nếu đọc được dòng này, máy in đã sẵn sàng.</p>
    </div>
  );
}

function BrowserView() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Ứng dụng Windows dùng cho máy tính quầy: in hóa đơn thẳng ra máy in nhiệt (không hiện hộp thoại in) và mở ngăn kéo tiền sau khi thu
        tiền mặt. Mọi thao tác khác giống hệt trang quản trị, dữ liệu vẫn ở máy chủ.
      </p>
      {publicEnv.desktopDownloadUrl ? (
        <a href={publicEnv.desktopDownloadUrl} className={buttonClass('primary', 'md', 'self-start')} rel="noopener noreferrer">
          <Download className="size-4" aria-hidden />
          Tải Rally Manager cho Windows
        </a>
      ) : (
        <p className="flex items-start gap-2 text-muted">
          <MonitorDown className="mt-0.5 size-4 shrink-0" aria-hidden />
          Chủ sân tạo bộ cài theo docs/HUONG-DAN-KY-THUAT.md mục 26 rồi điền link tải vào NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL để hiện nút tải ở
          đây.
        </p>
      )}
      <p className="text-muted">Windows 10 / 11. Cài xong, mở Rally Manager, đăng nhập rồi quay lại trang này để chọn máy in.</p>
    </div>
  );
}

/** Máy in & ngăn kéo tiền của máy quầy này (cài đặt lưu trên chính máy, không lưu lên máy chủ). */
export function DesktopPanel() {
  const desktop = useDesktopState();
  if (desktop.status === 'checking') return <p className="text-sm text-muted">Đang kiểm tra…</p>;
  if (desktop.status === 'browser') return <BrowserView />;
  return <SettingsForm info={desktop.info} saved={desktop.settings ?? DEFAULT_PRINTER_SETTINGS} />;
}

function SettingsForm({ info, saved }: { info: DesktopInfo | null; saved: PrinterSettings }) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [form, setForm] = useState<PrinterSettings>(saved);
  const [busy, setBusy] = useState<'save' | 'print' | 'drawer' | 'list' | null>(null);

  const loadPrinters = useCallback(async () => {
    const res = await callDesktop('list_printers', printerListSchema);
    if (res.ok) setPrinters(res.data);
    else toast.error(desktopErrorText(res.error));
  }, []);

  useEffect(() => {
    let alive = true;
    void callDesktop('list_printers', printerListSchema).then((res) => {
      if (alive && res.ok) setPrinters(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const patch = (p: Partial<PrinterSettings>) => setForm((f) => ({ ...f, ...p }));
  const options = printers.map((p) => ({ value: p.name, label: p.isDefault ? `${p.name} (mặc định)` : p.name }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const save = async (): Promise<boolean> => {
    setBusy('save');
    try {
      const res = await callDesktop('save_printer_settings', printerSettingsSchema, { settings: form });
      if (!res.ok) {
        toast.error(res.error.code === 'INVALID_SETTINGS' ? res.error.message : desktopErrorText(res.error));
        return false;
      }
      setForm(res.data);
      setDesktopSettings(res.data);
      toast.success('Đã lưu cài đặt máy in cho máy này.');
      return true;
    } finally {
      setBusy(null);
    }
  };

  const testPrint = async () => {
    if (dirty && !(await save())) return;
    setBusy('print');
    try {
      await printPage();
    } finally {
      setBusy(null);
    }
  };

  const testDrawer = async () => {
    if (dirty && !(await save())) return;
    setBusy('drawer');
    try {
      if (await openCashDrawer('manual', 'Mở thử')) toast.success('Đã gửi lệnh mở ngăn kéo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Rally Manager cho Windows {info?.appVersion ?? ''}. Cài đặt dưới đây chỉ áp dụng cho <strong>máy này</strong>.
      </p>

      <Field
        label="Máy in hóa đơn"
        hint="Chọn máy in nhiệt (khổ 80mm). Bỏ trống = bấm In sẽ hiện hộp thoại in như trình duyệt. Máy in cần cài driver Windows và đặt khổ giấy 80mm."
      >
        {(id) => (
          <div className="flex gap-2">
            <select
              id={id}
              value={form.receiptPrinter ?? ''}
              onChange={(e) => patch({ receiptPrinter: e.target.value || null })}
              className={cn(controlClass, 'min-h-11 pr-8')}
            >
              <option value="">— Dùng hộp thoại in —</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              aria-label="Tải lại danh sách máy in"
              title="Tải lại danh sách máy in"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('list');
                await loadPrinters();
                setBusy(null);
              }}
            >
              <RefreshCw className={cn('size-4', busy === 'list' && 'animate-spin')} aria-hidden />
            </Button>
          </div>
        )}
      </Field>

      <Field label="Số bản mỗi lần in">
        {(id) => (
          <select
            id={id}
            value={form.copies}
            onChange={(e) => patch({ copies: Number(e.target.value) })}
            className={cn(controlClass, 'min-h-11 max-w-40 pr-8')}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} bản
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="flex flex-col gap-4 rounded-control border border-line p-4">
        <Toggle
          checked={form.drawerEnabled}
          onChange={(v) => patch({ drawerEnabled: v })}
          label="Có ngăn kéo tiền nối với máy in"
          hint="Ngăn kéo cắm vào cổng DK (RJ11) phía sau máy in hóa đơn."
        />
        {form.drawerEnabled && (
          <>
            <Field label="Máy in điều khiển ngăn kéo">
              {(id) => (
                <select
                  id={id}
                  value={form.drawerPrinter ?? ''}
                  onChange={(e) => patch({ drawerPrinter: e.target.value || null })}
                  className={cn(controlClass, 'min-h-11 pr-8')}
                >
                  <option value="">Cùng máy in hóa đơn</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Chân kích ngăn kéo" hint="Phần lớn ngăn kéo dùng chân 2. Bấm Mở thử không mở được thì đổi sang chân 5.">
              {(id) => (
                <select
                  id={id}
                  value={form.drawerPin}
                  onChange={(e) => patch({ drawerPin: e.target.value === '1' ? 1 : 0 })}
                  className={cn(controlClass, 'min-h-11 max-w-40 pr-8')}
                >
                  <option value={0}>Chân 2</option>
                  <option value={1}>Chân 5</option>
                </select>
              )}
            </Field>
            <Toggle
              checked={form.autoOpenDrawer}
              onChange={(v) => patch({ autoOpenDrawer: v })}
              label="Tự mở khi thu tiền mặt"
              hint="Sau khi ghi đơn bán / thu tiền sân bằng tiền mặt thành công."
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={busy !== null || !dirty}>
          <Save className="size-4" aria-hidden />
          {busy === 'save' ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button variant="outline" onClick={() => void testPrint()} disabled={busy !== null}>
          <Printer className="size-4" aria-hidden />
          In thử
        </Button>
        {form.drawerEnabled && (
          <Button variant="outline" onClick={() => void testDrawer()} disabled={busy !== null}>
            <Archive className="size-4" aria-hidden />
            Mở ngăn kéo thử
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Mỗi lần mở ngăn kéo (tự động hoặc bằng tay) đều được ghi vào Nhật ký thay đổi.</p>
      <TestSheet printer={form.receiptPrinter} />
    </div>
  );
}
