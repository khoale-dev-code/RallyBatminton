'use client';

import { Check, Copy, MonitorSmartphone, Plus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useTransition } from 'react';

import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { controlClass } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

import { createKioskAction, revokeKioskAction } from '../actions';

export interface KioskRow {
  id: string;
  name: string;
  branchName: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

/**
 * Máy quầy: link riêng chỉ hiện mã QR (không cần đăng nhập tài khoản chủ sân trên máy đặt ở quầy).
 * Link chỉ hiện MỘT lần lúc tạo — database chỉ giữ mã băm. Mất link thì thu hồi và tạo máy mới.
 */
export function KioskPanel({ branchId, branchName, kiosks }: { branchId: string; branchName: string; kiosks: KioskRow[] }) {
  const [name, setName] = useState('');
  const [created, setCreated] = useState<{ url: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const active = kiosks.filter((k) => !k.revokedAt);

  const create = () =>
    start(async () => {
      const res = await createKioskAction(branchId, name);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCreated({ url: res.url, name: res.name });
      setName('');
      toast.success(`Đã tạo máy quầy “${res.name}”. Mở link trên máy tính bảng ở quầy.`);
    });

  return (
    <section aria-labelledby="kiosk-title" className="mt-8 rounded-panel border border-line bg-paper">
      <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
          <MonitorSmartphone className="size-5" />
        </span>
        <div>
          <h2 id="kiosk-title" className="text-xl">
            Máy quầy
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">
            Máy tính bảng ở quầy mở link riêng để hiện mã QR — <strong className="text-ink">không cần đăng nhập tài khoản chủ sân</strong>,
            nhân viên ở quầy không xem được bảng lương hay cài đặt. Mỗi máy một link; thu hồi bất cứ lúc nào.
          </p>
        </div>
      </header>
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label htmlFor="kiosk-name" className="sr-only">
              Tên máy
            </label>
            <input
              id="kiosk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Ví dụ: Máy tính bảng quầy ${branchName}`}
              maxLength={60}
              className={cn(controlClass, 'min-h-11 flex-1')}
            />
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              <Plus className="size-4" aria-hidden />
              {pending ? 'Đang tạo…' : 'Tạo máy quầy'}
            </Button>
          </form>

          {active.length === 0 ? (
            <p className="rounded-control bg-hall/70 px-4 py-3 text-sm text-muted">Chưa có máy quầy nào ở chi nhánh này.</p>
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line">
              {active.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{k.name}</span>
                    <span className="block text-sm text-muted">
                      {k.branchName} · {k.lastSeenAt ? `hoạt động ${formatDateTime(k.lastSeenAt)}` : 'chưa mở lần nào'}
                    </span>
                  </span>
                  <ActionButton
                    action={revokeKioskAction.bind(null, k.id)}
                    label="Thu hồi"
                    variant="danger"
                    confirmMessage={`Thu hồi “${k.name}”? Máy này sẽ ngừng hiện mã QR ngay.`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-control bg-hall/70 p-4 text-sm">
          {created ? (
            <>
              <p className="font-medium">Link của “{created.name}” — chỉ hiện một lần</p>
              <p className="text-muted">
                Dùng camera máy tính bảng quét mã này, hoặc sao chép link và mở trên máy đó. Lưu thành dấu trang.
              </p>
              <div className="mx-auto w-40 rounded-control bg-paper p-2">
                <QRCodeSVG value={created.url} size={160} level="M" marginSize={1} className="h-auto w-full" title="Link máy quầy" />
              </div>
              <code className="block rounded bg-paper px-2 py-1.5 text-xs break-all">{created.url}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.url).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? 'Đã sao chép' : 'Sao chép link'}
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium">Cách dùng</p>
              <ol className="ml-4 flex list-decimal flex-col gap-1.5 text-muted">
                <li>Đặt tên máy rồi bấm Tạo máy quầy.</li>
                <li>Mở link vừa tạo trên máy tính bảng ở quầy (quét mã QR hiện ra).</li>
                <li>Máy tự đổi mã liên tục. Mất máy / nghỉ dùng thì bấm Thu hồi.</li>
              </ol>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
