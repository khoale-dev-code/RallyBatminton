import Link from 'next/link';

import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { RentalCheckoutForm } from '@/features/admin-rentals/components/rental-checkout-form';
import { getRentalCatalog, listActiveBookings } from '@/features/admin-rentals/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { newIdempotencyKey } from '@/lib/ids';
import { requestNow } from '@/lib/time';

export const metadata = { title: 'Tạo phiếu thuê' };

export default async function NewRentalPage() {
  const { branch } = await requireBranchPermission('rental.operate');
  const now = requestNow();
  const [options, bookings] = await Promise.all([getRentalCatalog(branch.branchId), listActiveBookings(branch.branchId, now)]);
  return (
    <>
      <PageHeader
        title="Tạo phiếu thuê"
        description={`${branch.name}. Chọn hình thức, món, gói giá rồi giao đồ.`}
        back={
          <Link href="/admin/rentals" className="text-sm text-muted hover:underline">
            Cho thuê
          </Link>
        }
      />
      {options.length === 0 ? (
        <EmptyState title="Chưa có đồ cho thuê sẵn sàng">
          <p className="text-muted">Cần sản phẩm cho thuê có gói giá và đã nhập kho tại chi nhánh này.</p>
        </EmptyState>
      ) : (
        <RentalCheckoutForm options={options} bookings={bookings} idempotencyKey={newIdempotencyKey()} serverNow={now} />
      )}
    </>
  );
}
