'use client';

import { QRCodeSVG } from 'qrcode.react';

import { Countdown } from '@/components/ui/interactive';

import { useRotatingQr } from '../hooks/use-rotating-qr';

/** Màn hình quầy: mã QR đổi liên tục, nhân viên quét bằng camera điện thoại để vào/ra ca. */
export function QrKiosk({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { url, expiresAt, error } = useRotatingQr(branchId);
  return (
    <section className="flex flex-col items-center gap-6 rounded-panel border border-line bg-paper px-4 py-8 text-center sm:px-8">
      <div>
        <p className="text-sm text-muted">Chấm công tại</p>
        <h2 className="text-3xl">{branchName}</h2>
      </div>
      <div className="grid aspect-square w-full max-w-[22rem] place-items-center rounded-panel bg-paper p-4 ring-1 ring-line">
        {url ? (
          <QRCodeSVG value={url} size={320} level="M" marginSize={2} className="h-auto w-full" title="Mã QR chấm công" />
        ) : (
          <p className="text-muted">{error ?? 'Đang tạo mã…'}</p>
        )}
      </div>
      {expiresAt && (
        <p className="text-sm text-muted">
          Mã tự đổi sau <Countdown until={expiresAt} className="font-display text-base text-ink" expiredLabel="giây lát" />
        </p>
      )}
      {error && url && <p className="text-sm text-shuttle-deep">{error}</p>}
      <ol className="max-w-md text-left text-[0.95rem] leading-relaxed">
        <li>1. Mở camera điện thoại, quét mã.</li>
        <li>2. Đăng nhập tài khoản nhân viên nếu được hỏi.</li>
        <li>3. Bấm Vào ca hoặc Ra ca.</li>
      </ol>
    </section>
  );
}
