import { notFound } from 'next/navigation';

import { Wordmark } from '@/components/brand/logo';
import { QrKiosk } from '@/features/attendance/components/qr-kiosk';
import { parseQrMode } from '@/features/attendance/lib/qr-mode';

export const metadata = { title: 'Máy quầy chấm công', robots: { index: false, follow: false } };

/**
 * Máy quầy: mở link riêng (chủ sân tạo trong mục Mã QR) trên máy tính bảng đặt ở quầy. Không cần đăng nhập,
 * chỉ hiện mã QR vào ca / ra ca của chi nhánh — không xem được dữ liệu nào khác. Thu hồi link là máy ngừng hiện mã.
 */
export default async function KioskPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ loai?: string }>;
}) {
  const [{ token }, { loai }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  return (
    <div className="theme-admin flex min-h-dvh flex-col bg-hall text-ink">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 sm:px-8">
        <Wordmark className="h-8" />
        <span className="text-sm text-muted">Máy quầy chấm công</span>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-6 sm:px-8">
        <QrKiosk source={{ kind: 'kiosk', deviceToken: token }} mode={parseQrMode(loai)} />
      </main>
    </div>
  );
}
