import { Plus } from 'lucide-react';

import { LinkButton } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Panel, PageHeader } from '@/components/ui/primitives';
import { RentalBoard } from '@/features/admin-rentals/components/rental-board';
import { OvertimePolicyCard, PriceBoard, RentalHistory, RentalStats } from '@/features/admin-rentals/components/rental-overview';
import { listPriceBoard, listRentals } from '@/features/admin-rentals/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { formatDate } from '@/lib/format';
import { requestNow } from '@/lib/time';

export const metadata = { title: 'Cho thuê' };

export default async function RentalsPage() {
  const { branch } = await requireBranchPermission('rental.operate');
  const [{ board, history, today }, prices] = await Promise.all([listRentals(branch.branchId), listPriceBoard()]);
  const now = requestNow();

  return (
    <>
      <PageHeader
        title="Cho thuê"
        description={`${branch.name} · ${formatDate(new Date(now))}. Theo dõi ai đang thuê, hạn trả và phụ phí trễ.`}
        actions={
          <LinkButton href="/admin/rentals/new" variant="primary">
            <Plus className="size-4" aria-hidden />
            Tạo phiếu thuê
          </LinkButton>
        }
      />
      <div className="flex flex-col gap-6">
        <RentalStats items={board} now={now} today={today} />
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Đang cho thuê" description="Sắp xếp theo hạn trả, phiếu trễ lên đầu. Tự cập nhật mỗi 15 giây.">
              <RentalBoard items={board} serverNow={now} />
            </Panel>
            <Panel title="Đã trả gần đây" description="3 ngày qua, mới nhất trước.">
              <RentalHistory items={history} />
            </Panel>
          </div>
          <aside className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
            <CollapsibleSection title="Bảng giá thuê" description="Báo giá nhanh cho khách." summary={`${prices.length} món`} defaultOpen>
              <PriceBoard rows={prices} />
            </CollapsibleSection>
            <CollapsibleSection title="Cách tính phụ phí trễ" description="Hệ thống tự tính khi nhận trả." defaultOpen>
              <OvertimePolicyCard />
            </CollapsibleSection>
          </aside>
        </div>
      </div>
    </>
  );
}
