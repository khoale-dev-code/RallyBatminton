import { PageHeader } from '@/components/ui/primitives';
import { QrKiosk } from '@/features/attendance/components/qr-kiosk';
import { requireBranchPermission, requireOwner } from '@/lib/auth/guards';

export const metadata = { title: 'Mã QR chấm công' };

export default async function AttendanceQrPage() {
  await requireOwner();
  const { branch } = await requireBranchPermission('shift.view_branch');
  return (
    <>
      <PageHeader
        title="Mã QR chấm công"
        description="Mở trang này trên máy tính hoặc máy tính bảng đặt tại quầy. Đổi chi nhánh ở thanh bên để hiện mã của chi nhánh khác."
      />
      <QrKiosk branchId={branch.branchId} branchName={branch.name} />
    </>
  );
}
