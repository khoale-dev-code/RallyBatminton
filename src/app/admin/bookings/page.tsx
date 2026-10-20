import Link from 'next/link';

import { LinkButton } from '@/components/ui/button';
import { DayNav } from '@/components/ui/day-nav';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { DayBoard } from '@/features/admin-bookings/components/day-board';
import { getBookingDay } from '@/features/admin-bookings/queries';
import { requireBranchData } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { formatDateKey, formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_STATUS } from '@/lib/labels';
import { isDateKey, todayKey } from '@/lib/time';

export const metadata = { title: 'Lịch đặt sân' };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const dateKey = date && isDateKey(date) ? date : todayKey();
  const { ctx, branch, data } = await requireBranchData('booking.view', (branchId) => getBookingDay(branchId, dateKey));
  if (!data) return <EmptyState title="Không tải được chi nhánh" />;
  const canOperate = hasPermission(ctx, 'booking.operate', branch.branchId);
  const tz = data.branch.timezone;
  const held = data.bookings.filter((b) => b.status === 'held').length;

  return (
    <>
      <PageHeader
        title="Lịch đặt sân"
        description={`${data.branch.name}. ${formatDateKey(dateKey)}${held ? `. ${held} đơn đang chờ xác nhận.` : '.'}`}
        actions={
          canOperate ? (
            <LinkButton href={`/admin/bookings/new?date=${dateKey}`} variant="primary">
              Tạo đơn tại quầy
            </LinkButton>
          ) : null
        }
      />
      <DayNav basePath="/admin/bookings" dateKey={dateKey} />

      <div className="flex flex-col gap-8">
        {data.courts.length === 0 ? (
          <EmptyState title="Chi nhánh chưa có sân" />
        ) : (
          <DayBoard
            dateKey={dateKey}
            tz={tz}
            opensAt={data.branch.opens_at}
            closesAt={data.branch.closes_at}
            courts={data.courts}
            bookings={data.bookings}
            canOperate={canOperate}
          />
        )}

        {/* Điện thoại: danh sách đơn lên trước (dễ đọc hơn lưới sân × giờ). */}
        <section className="order-first md:order-none">
          <h2 className="mb-3 text-xl">Tất cả đơn trong ngày</h2>
          {data.bookings.length === 0 ? (
            <p className="text-muted">Chưa có đơn nào.</p>
          ) : (
            <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
              {data.bookings.map((b) => {
                const st = BOOKING_STATUS[b.status];
                const court = data.courts.find((c) => c.id === b.court_id)?.name ?? '';
                return (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 hover:bg-hall/60 sm:grid-cols-[110px_1fr_auto_auto] sm:items-center sm:px-6"
                    >
                      <span className="font-display text-lg tabular">
                        {formatTime(b.start, tz)}–{formatTime(b.end, tz)}
                      </span>
                      <span className="min-w-0 sm:order-none">
                        <span className="font-medium">{b.kind === 'block' ? 'Khóa sân' : b.contact_name}</span>
                        <span className="text-sm text-muted">
                          {' '}
                          {court}
                          {b.customers?.phone ? `, ${formatPhone(b.customers.phone)}` : ''}, {b.code}
                        </span>
                      </span>
                      <span className="text-sm tabular sm:text-right">
                        {b.kind === 'customer' && (b.balance > 0 ? `Còn thu ${formatVnd(b.balance)}` : 'Đã thu đủ')}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
