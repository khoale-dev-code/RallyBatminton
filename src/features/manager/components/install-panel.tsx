'use client';

import { CheckCircle2, Download, MonitorSmartphone, Share, SquarePlus } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { toast } from '@/components/ui/toast';

import { getInstalled, getInstallPrompt, promptInstall, subscribeInstall } from '../lib/install-store';
import { isIos, isStandalone } from '../lib/live';

const noop = () => () => undefined;

/** Nút / hướng dẫn cài Rally Manager phù hợp với trình duyệt đang dùng. */
export function InstallPanel() {
  const prompt = useSyncExternalStore(subscribeInstall, getInstallPrompt, () => null);
  const installed = useSyncExternalStore(subscribeInstall, getInstalled, () => false);
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const ios = useSyncExternalStore(
    noop,
    () => isIos(navigator.userAgent),
    () => false,
  );
  const [busy, setBusy] = useState(false);

  if (standalone || installed) {
    return (
      <p className="flex items-start gap-2 rounded-control bg-court-soft px-4 py-3 text-sm text-court-deep">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {standalone
          ? 'Bạn đang dùng Rally Manager dạng ứng dụng.'
          : 'Đã cài Rally Manager. Mở từ biểu tượng trên màn hình nền / menu Start.'}
      </p>
    );
  }

  if (prompt) {
    return (
      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await promptInstall();
            setBusy(false);
            if (ok) toast.success('Đã cài Rally Manager.');
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 font-medium text-paper hover:bg-primary-hover disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden />
          Cài Rally Manager
        </button>
        <p className="text-sm text-muted">
          Trình duyệt sẽ hỏi xác nhận. Sau khi cài, Rally Manager có biểu tượng riêng và mở thành cửa sổ riêng.
        </p>
      </div>
    );
  }

  if (ios) {
    return (
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Mở trang này bằng <strong>Safari</strong>.
        </li>
        <li className="flex-wrap">
          Bấm nút <Share className="inline size-4 align-text-bottom" aria-label="Chia sẻ" /> <strong>Chia sẻ</strong> ở thanh dưới.
        </li>
        <li>
          Chọn <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> <strong>Thêm vào MH chính</strong> →{' '}
          <strong>Thêm</strong>.
        </li>
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-start gap-2">
        <MonitorSmartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        Trình duyệt chưa hiện nút cài tự động. Cài thủ công:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-9 text-muted">
        <li>
          <strong className="text-ink">Máy tính (Chrome / Edge):</strong> bấm biểu tượng cài ở cuối thanh địa chỉ, hoặc menu ⋮ → tìm{' '}
          <em>Cài đặt Rally Manager</em> (Chrome: trong <em>Truyền, lưu và chia sẻ</em>; Edge: trong <em>Ứng dụng</em>).
        </li>
        <li>
          <strong className="text-ink">Android (Chrome):</strong> menu ⋮ → <em>Thêm vào màn hình chính</em> → <em>Cài đặt</em>.
        </li>
        <li>
          <strong className="text-ink">Firefox:</strong> chưa hỗ trợ cài ứng dụng — dùng Chrome hoặc Edge.
        </li>
      </ul>
    </div>
  );
}
