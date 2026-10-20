import Link from 'next/link';

import { LinkButton } from '@/components/ui/button';
import { DayNav } from '@/components/ui/day-nav';
import { Badge, EmptyState, PageHeader, Panel, Stat } from '@/components/ui/primitives';
import { listSalesForDay } from '@/features/admin-sales/queries';
import { requireBranchPermission } from '@/lib/auth/guards';
import { formatDateKey, formatTime, formatVnd } from '@/lib/format';
import { PAYMENT_METHOD } from '@/lib/labels';
import { isDateKey, todayKey } from '@/lib/time';

export const metadata = { title: 'Đơn bán' };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { branch } = await requireBranchPermission('sale.record');
  const { date } = await searchParams;
  const dateKey = date && isDateKey(date) ? date : todayKey();
  const { sales, revenue, count } = await listSalesForDay(branch.branchId, dateKey);

  return (
    <>
      <PageHeader
        title="Đơn bán"
        description={`${branch.name}. ${formatDateKey(dateKey)}.`}
        actions={
          <LinkButton href="/admin/pos" variant="primary">
            Mở quầy bán
          </LinkButton>
        }
      />
      <DayNav basePath="/admin/sales" dateKey={dateKey} />
      <Panel className="mb-6">
        <div className="grid grid-cols-2 gap-6">
          <Stat label="Doanh thu bán hàng" value={<span className="font-display text-3xl tabular">{formatVnd(revenue)}</span>} />
          <Stat label="Số đơn" value={<span className="font-display text-3xl tabular">{count}</span>} />
        </div>
      </Panel>
      {sales.length === 0 ? (
        <EmptyState title="Chưa có đơn bán trong ngày" />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
          {sales.map((s) => {
            const items = s.sale_lines.reduce((n, l) => n + l.quantity, 0);
            const method = s.payments.find((p) => p.status === 'succeeded' || p.status === 'pending')?.method ?? s.payments[0]?.method;
            return (
              <li key={s.id}>
                <Link href={`/admin/sales/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-hall/60 sm:px-6">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium tabular">
                      {formatTime(s.sold_at)} <span className="text-muted">{s.code}</span>
                    </span>
                    <span className="text-sm text-muted">
                      {[`${items} món`, method ? PAYMENT_METHOD[method] : null, s.customers?.full_name].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {s.status === 'voided' && <Badge tone="red">Đã hủy</Badge>}
                    {s.status === 'completed' && s.payments.some((p) => p.status === 'pending') && (
                      <Badge tone="amber">Chờ chuyển khoản</Badge>
                    )}
                    <span className={s.status === 'voided' ? 'text-muted line-through tabular' : 'font-display text-lg tabular'}>
                      {formatVnd(s.total_amount)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
