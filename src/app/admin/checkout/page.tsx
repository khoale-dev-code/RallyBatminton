import { ArrowRight, CircleCheck, Plus, Search } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { DayNav } from '@/components/ui/day-nav';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { getBookingDay, type DayBooking } from '@/features/admin-bookings/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatPhone, formatTime, formatVnd } from '@/lib/format';
import { BOOKING_STATUS } from '@/lib/labels';
import { isDateKey, requestNow, todayKey } from '@/lib/time';

export const metadata = { title: 'Thu tiền sân' };

const PAYABLE = new Set(['held', 'confirmed', 'checked_in', 'completed']);

function matches(b: DayBooking, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase().replace(/\s+/g, '');
  const hay = [b.code, b.contact_name ?? '', b.customers?.phone ?? ''].join(' ').toLowerCase().replace(/\s+/g, '');
  return hay.includes(needle) || hay.includes(needle.replace(/^0/, '+84'));
}

function Row({ b, tz, now }: { b: DayBooking; tz: string; now: number }) {
  const status = BOOKING_STATUS[b.status];
  const playing = b.start.getTime() <= now && b.end.getTime() > now;
  const ended = b.end.getTime() <= now;
  const due = Math.max(0, b.balance);
  return (
    <li>
      <Link
        href={`/admin/checkout/${b.id}`}
        className={cn(
          'group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border bg-paper p-4 transition-shadow hover:shadow-lift',
          due > 0 && (playing || ended) ? 'border-court' : 'border-line',
        )}
      >
        <span className="flex w-24 shrink-0 flex-col">
          <span className="font-display text-xl tabular">{formatTime(b.start, tz)}</span>
          <span className="text-sm text-muted tabular">đến {formatTime(b.end, tz)}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">
            {b.contact_name ?? 'Khách'}
            {b.customers?.phone && <span className="ml-2 font-normal text-muted">{formatPhone(b.customers.phone)}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="tabular">{b.code}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {playing && <Badge tone="green">Đang chơi</Badge>}
            {ended && due > 0 && <Badge tone="red">Đã hết giờ</Badge>}
          </span>
        </span>
        <span className="flex flex-col items-end">
          {due > 0 ? (
            <>
              <span className="text-sm text-muted">Còn phải thu</span>
              <span className="font-display text-2xl tabular">{formatVnd(due)}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-court-deep">
              <CircleCheck className="size-4" aria-hidden />
              Đã thu đủ {formatVnd(b.total)}
            </span>
          )}
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

/** Thu tiền sân: đơn trong ngày của chi nhánh, đơn đang chơi / hết giờ còn nợ lên đầu. */
export default async function CheckoutListPage({ searchParams }: { searchParams: Promise<{ date?: string; q?: string }> }) {
  const { branch } = await requireBranchPermission('payment.record');
  const params = await searchParams;
  const today = todayKey();
  const date = params.date && isDateKey(params.date) ? params.date : today;
  const q = (params.q ?? '').trim().slice(0, 40);
  const day = await getBookingDay(branch.branchId, date);
  const tz = day?.branch.timezone ?? 'Asia/Ho_Chi_Minh';
  const now = requestNow();
  const list = (day?.bookings ?? []).filter((b) => b.kind === 'customer' && PAYABLE.has(b.status) && matches(b, q));
  const owing = list
    .filter((b) => b.balance > 0)
    .sort((a, b) => {
      const rank = (x: DayBooking) => (x.start.getTime() <= now ? 0 : 1);
      return rank(a) - rank(b) || a.start.getTime() - b.start.getTime();
    });
  const settled = list.filter((b) => b.balance <= 0);

  return (
    <>
      <PageHeader
        title="Thu tiền sân"
        description={`${branch.name}. Chọn đơn để thu tiền mặt hoặc cho khách quét mã QR chuyển khoản — tiền về là tự xác nhận. Khách chơi thêm giờ: mở đơn và bấm gia hạn trước khi thu.`}
        actions={
          <Link href={`/admin/bookings/new${date !== today ? `?date=${date}` : ''}`} className={buttonClass('outline')}>
            <Plus className="size-4" aria-hidden />
            Khách vãng lai — đặt tại quầy
          </Link>
        }
      />
      <DayNav dateKey={date} basePath="/admin/checkout" />
      <form action="/admin/checkout" className="mb-5 flex gap-2" role="search">
        {date !== today && <input type="hidden" name="date" value={date} />}
        <label className="relative flex-1">
          <span className="sr-only">Tìm đơn</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Mã đơn, tên hoặc số điện thoại khách"
            className="min-h-11 w-full rounded-control border border-line bg-paper pr-3 pl-9 text-[0.95rem] hover:border-ink/40 focus:border-ink focus:ring-2 focus:ring-ink/10 focus:outline-none"
          />
        </label>
      </form>

      {list.length === 0 ? (
        <EmptyState title={q ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn đặt sân trong ngày'}>
          {q ? 'Thử tìm bằng 4 số cuối điện thoại hoặc mã đơn.' : 'Đơn đặt sân trong ngày sẽ hiện ở đây.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Cần thu tiền">
            <h2 className="mb-3 text-lg">Cần thu ({owing.length})</h2>
            {owing.length === 0 ? (
              <p className="text-muted">Mọi đơn trong ngày đã thu đủ.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {owing.map((b) => (
                  <Row key={b.id} b={b} tz={tz} now={now} />
                ))}
              </ul>
            )}
          </section>
          {settled.length > 0 && (
            <section aria-label="Đã thu đủ">
              <h2 className="mb-3 text-lg text-muted">Đã thu đủ ({settled.length})</h2>
              <ul className="flex flex-col gap-2.5 opacity-80">
                {settled.map((b) => (
                  <Row key={b.id} b={b} tz={tz} now={now} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
