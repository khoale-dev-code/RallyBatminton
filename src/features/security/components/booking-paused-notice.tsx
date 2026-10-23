import { Notice } from '@/components/ui/notice';

import { getOnlineBookingStatus } from '../queries';

/** Chủ sân tạm dừng đặt sân online (Bảo mật → Đặt sân online): báo trước để khách gọi chi nhánh. */
export async function BookingPausedNotice({ className }: { className?: string }) {
  const status = await getOnlineBookingStatus();
  if (!status.paused) return null;
  return (
    <Notice tone="warning" title="Đặt sân online đang tạm dừng" className={className}>
      {status.message ?? 'Vui lòng gọi hotline chi nhánh để đặt sân. Xin lỗi vì sự bất tiện.'}
    </Notice>
  );
}
