import Link from 'next/link';

import { LinkButton } from '@/components/ui/button';
import { Countdown } from '@/components/ui/interactive';
import { Badge, EmptyState, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { getDashboard } from '@/features/dashboard/queries';
import { getActiveBranch } from '@/lib/auth/context';
import { requestNow } from '@/lib/time';
import { requireStaff } from '@/lib/auth/guards';
import { formatDate, formatTime, formatVariantLabel, formatVnd } from '@/lib/format';
import { ATTENDANCE_STATUS, BOOKING_STATUS } from '@/lib/labels';

export const metadata = { title: 'Tổng quan' };

export default async function DashboardPage() {
  const ctx = await requireStaff();
  const branch = await getActiveBranch(ctx);
  const d = await getDashboard(ctx, branch);
  const held = d.bookings?.filter((b) => b.status === 'held') ?? [];
  const live = d.bookings?.filter((b) => b.kind === 'customer' && ['confirmed', 'checked_in'].includes(b.status)) ?? [];
  const now = requestNow();
  const upcoming = live.filter((b) => b.end.getTime() > now).slice(0, 8);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${ctx.displayName}`}
        description={d.branchName ? `${d.branchName}, hôm nay ${formatDate(new Date())}.` : 'Bạn chưa được gán chi nhánh nào.'}
      />

      {!d.branchName && ctx.role !== 'owner' && (
        <EmptyState title="Chưa có quyền ở chi nhánh nào">Liên hệ chủ sân để được cấp quyền theo chi nhánh.</EmptyState>
      )}
      {!d.branchName && ctx.role === 'owner' && (
        <EmptyState
          title="Bắt đầu bằng chi nhánh đầu tiên"
          action={
            <LinkButton href="/admin/branches/new" variant="primary">
              Thêm chi nhánh
            </LinkButton>
          }
        >
          Tạo chi nhánh, thêm sân và bảng giá rồi công bố để khách đặt sân.
        </EmptyState>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {d.bookings && (
          <Panel>
            <Stat
              label="Đơn hôm nay"
              value={live.length + held.length}
              hint={held.length ? `${held.length} đang chờ xác nhận` : 'Không có đơn chờ'}
            />
          </Panel>
        )}
        {d.revenue !== null && (
          <Panel>
            <Stat label="Tiền thu hôm nay" value={formatVnd(d.revenue)} hint="Đã trừ tiền hoàn" />
          </Panel>
        )}
        {d.rentalsOut && (
          <Panel>
            <Stat
              label="Đang cho thuê"
              value={d.rentalsOut.length}
              hint={d.overdue.length ? `${d.overdue.length} lượt quá hạn` : 'Không có lượt quá hạn'}
            />
          </Panel>
        )}
        {d.lowStock && (
          <Panel>
            <Stat label="Hàng sắp hết" value={d.lowStock.length} hint="Tồn ≤ mức đặt lại" />
          </Panel>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {held.length > 0 && (
          <Panel title="Chờ xác nhận" description="Giữ chỗ tự hết hạn nếu không xác nhận kịp.">
            <ul className="divide-y divide-line">
              {held.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                    <span>
                      <span className="font-medium">{b.contact_name}</span>
                      <span className="text-sm text-muted">
                        {' '}
                        {b.courts?.name}, {formatTime(b.start)}–{formatTime(b.end)}
                      </span>
                    </span>
                    {b.hold_expires_at && (
                      <Countdown until={b.hold_expires_at} className="shrink-0 font-display text-lg text-shuttle-deep" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.bookings && (
          <Panel
            title="Sắp tới hôm nay"
            actions={
              <Link href="/admin/bookings" className="text-sm underline underline-offset-4">
                Mở lịch
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <p className="text-muted">Không còn đơn nào trong hôm nay.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-hall/60">
                      <span>
                        <span className="font-display text-lg tabular">{formatTime(b.start)}</span>
                        <span className="ml-3">{b.contact_name}</span>
                        <span className="text-sm text-muted">, {b.courts?.name}</span>
                      </span>
                      <Badge tone={BOOKING_STATUS[b.status].tone} className="shrink-0">
                        {BOOKING_STATUS[b.status].label}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {d.overdue.length > 0 && (
          <Panel title="Thiết bị quá hạn trả">
            <ul className="divide-y divide-line">
              {d.overdue.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/rentals/${r.id}`} className="flex justify-between gap-3 py-3 hover:bg-hall/60">
                    <span>
                      {r.customers?.full_name} <span className="text-sm text-muted">{r.code}</span>
                    </span>
                    <span className="shrink-0 text-sm whitespace-nowrap text-shuttle-deep">hạn {formatTime(r.due_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.lowStock && d.lowStock.length > 0 && (
          <Panel
            title="Hàng sắp hết"
            actions={
              <Link href="/admin/inventory" className="text-sm underline underline-offset-4">
                Tồn kho
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {d.lowStock.slice(0, 8).map((s, i) => (
                <li key={`${s.product_variants?.sku}-${i}`} className="flex justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    {s.product_variants?.products?.name}
                    {s.product_variants && formatVariantLabel(s.product_variants.size_label, s.product_variants.color_label)
                      ? ` (${formatVariantLabel(s.product_variants.size_label, s.product_variants.color_label)})`
                      : ''}
                  </span>
                  <span className="shrink-0 font-medium whitespace-nowrap tabular">còn {s.on_hand}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.nextShift && (
          <Panel
            title="Ca tiếp theo của bạn"
            actions={
              <Link href="/admin/me" className="text-sm underline underline-offset-4">
                Lịch của tôi
              </Link>
            }
          >
            <p className="font-display text-2xl tabular">
              {formatTime(d.nextShift.scheduled_start)}–{formatTime(d.nextShift.scheduled_end)}
            </p>
            <p className="text-muted">
              {formatDate(d.nextShift.scheduled_start)}, {d.nextShift.branches?.name}
            </p>
            <Badge tone={ATTENDANCE_STATUS[d.nextShift.status].tone} className="mt-2">
              {d.nextShift.checked_in_at ? 'Đang trong ca' : ATTENDANCE_STATUS[d.nextShift.status].label}
            </Badge>
          </Panel>
        )}
      </div>
    </>
  );
}
