'use client';

import { LogIn, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Countdown } from '@/components/ui/interactive';
import { cn } from '@/lib/cn';

import { useRotatingQr, type QrSource } from '../hooks/use-rotating-qr';
import { type QrMode } from '../lib/qr-mode';

const KINDS = {
  checkin: {
    label: 'Vào ca',
    hint: 'Quét khi bắt đầu ca',
    icon: LogIn,
    band: 'bg-primary text-paper',
    ring: 'ring-primary/25',
  },
  checkout: {
    label: 'Ra ca',
    hint: 'Quét khi kết thúc ca',
    icon: LogOut,
    band: 'bg-shuttle text-paper',
    ring: 'ring-shuttle/25',
  },
} as const;

function QrCard({
  kind,
  url,
  error,
  compact,
}: {
  kind: 'checkin' | 'checkout';
  url: string | null;
  error: string | null;
  compact: boolean;
}) {
  const k = KINDS[kind];
  const Icon = k.icon;
  return (
    <figure
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-panel bg-paper ring-2',
        k.ring,
        compact ? 'max-w-[20rem]' : 'max-w-[24rem]',
      )}
    >
      <figcaption className={cn('flex items-center justify-center gap-2.5 px-4 py-3', k.band)}>
        <Icon className="size-6" aria-hidden />
        <span className="font-display text-2xl tracking-wide uppercase">{k.label}</span>
      </figcaption>
      <div className="grid aspect-square place-items-center p-4">
        {url ? (
          <QRCodeSVG
            value={`${url}&e=${kind}`}
            size={320}
            level="M"
            marginSize={2}
            className="h-auto w-full"
            title={`Mã QR ${k.label.toLowerCase()}`}
          />
        ) : (
          <p className="text-muted">{error ?? 'Đang tạo mã…'}</p>
        )}
      </div>
      <p className="border-t border-line px-4 py-2.5 text-sm text-muted">{k.hint}</p>
    </figure>
  );
}

/**
 * Màn hình quầy: mã QR VÀO CA (xanh) và RA CA (đỏ), đổi liên tục. Nhân viên quét đúng mã là ghi đúng việc —
 * không phải chọn lại trên điện thoại. Hai mã dùng chung một token (đổi 75 giây/lần), chỉ khác loại.
 */
export function QrKiosk({ source, branchName, mode }: { source: QrSource; branchName?: string; mode: QrMode }) {
  const { url, expiresAt, error, branchName: issuedFor } = useRotatingQr(source);
  const kinds = mode === 'both' ? (['checkin', 'checkout'] as const) : ([mode] as const);
  return (
    <section className="flex flex-col items-center gap-6 rounded-panel border border-line bg-paper px-4 py-8 text-center sm:px-8">
      <div>
        <p className="text-sm text-muted">Chấm công tại</p>
        <h2 className="text-3xl">{branchName ?? issuedFor ?? '…'}</h2>
      </div>
      <div className={cn('grid w-full justify-items-center gap-6', mode === 'both' && 'md:grid-cols-2 md:gap-8')}>
        {kinds.map((kind) => (
          <QrCard key={kind} kind={kind} url={url} error={error} compact={mode === 'both'} />
        ))}
      </div>
      {expiresAt && (
        <p className="text-sm text-muted" aria-live="polite">
          Mã tự đổi sau <Countdown until={expiresAt} className="font-display text-base text-ink" expiredLabel="giây lát" />
        </p>
      )}
      {error && url && <p className="text-sm text-shuttle-deep">{error}</p>}
      <ol className="max-w-md text-left text-[0.95rem] leading-relaxed">
        <li>1. Mở camera điện thoại, quét mã {mode === 'checkout' ? 'RA CA' : mode === 'checkin' ? 'VÀO CA' : 'VÀO CA hoặc RA CA'}.</li>
        <li>2. Đăng nhập tài khoản nhân viên nếu được hỏi.</li>
        <li>3. Bấm xác nhận — giờ vào / ra được ghi ngay.</li>
      </ol>
    </section>
  );
}
