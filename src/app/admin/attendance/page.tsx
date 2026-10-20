import { LogIn, LogOut, QrCode } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/primitives';
import { KioskPanel } from '@/features/attendance/components/kiosk-panel';
import { QrKiosk } from '@/features/attendance/components/qr-kiosk';
import { parseQrMode, type QrMode } from '@/features/attendance/lib/qr-mode';
import { listKiosks } from '@/features/attendance/queries';
import { requireBranchPermission, requireOwner } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Mã QR' };

const TABS: Array<{ mode: QrMode; param: string | null; label: string; icon: typeof QrCode }> = [
  { mode: 'both', param: null, label: 'Cả hai mã', icon: QrCode },
  { mode: 'checkin', param: 'vao', label: 'Mã vào ca', icon: LogIn },
  { mode: 'checkout', param: 'ra', label: 'Mã ra ca', icon: LogOut },
];

export default async function AttendanceQrPage({ searchParams }: { searchParams: Promise<{ loai?: string }> }) {
  await requireOwner();
  const [{ branch }, { loai }, kiosks] = await Promise.all([requireBranchPermission('shift.view_branch'), searchParams, listKiosks()]);
  const mode = parseQrMode(loai);
  return (
    <>
      <PageHeader
        title="Mã QR"
        description="Mở trên máy tính hoặc máy tính bảng tại quầy. Nhân viên quét mã VÀO CA khi bắt đầu, mã RA CA khi kết thúc. Đổi chi nhánh ở thanh bên để hiện mã của chi nhánh khác."
      />
      <nav aria-label="Loại mã" className="mb-4 flex w-full gap-1 rounded-control border border-line bg-paper p-1 sm:w-fit">
        {TABS.map((t) => {
          const on = t.mode === mode;
          return (
            <Link
              key={t.mode}
              href={t.param ? `/admin/attendance?loai=${t.param}` : '/admin/attendance'}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[0.4rem] px-3 text-sm font-medium whitespace-nowrap sm:flex-none sm:px-4',
                on ? (t.mode === 'checkout' ? 'bg-shuttle text-paper' : 'bg-primary text-paper') : 'text-muted hover:text-primary',
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <QrKiosk source={{ kind: 'owner', branchId: branch.branchId }} branchName={branch.name} mode={mode} />
      <p className="mt-3 text-sm text-muted">
        Mở được nhiều màn hình mã QR cùng lúc (ví dụ cửa vào và cửa ra). Máy đặt ở quầy nên dùng{' '}
        <strong className="text-ink">Máy quầy</strong> bên dưới thay vì đăng nhập tài khoản chủ sân.
      </p>
      <KioskPanel
        branchId={branch.branchId}
        branchName={branch.name}
        kiosks={kiosks
          .filter((k) => k.branch_id === branch.branchId)
          .map((k) => ({
            id: k.id,
            name: k.name,
            branchName: k.branches?.name ?? branch.name,
            createdAt: k.created_at,
            lastSeenAt: k.last_seen_at,
            revokedAt: k.revoked_at,
          }))}
      />
    </>
  );
}
