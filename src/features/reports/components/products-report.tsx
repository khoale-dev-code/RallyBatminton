import Link from 'next/link';

import { Panel } from '@/components/ui/primitives';
import { formatDate, formatVnd } from '@/lib/format';

import { type ProductsReport as Data } from '../queries';
import { HBarList, Metric } from './charts';
import { DataTable } from './data-table';

export function ProductsReport({ data }: { data: Data }) {
  const avg = data.orders > 0 ? Math.round(data.revenue / data.orders) : 0;
  const anyCost = data.top.some((t) => t.cost !== null);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Doanh thu bán hàng"
          value={formatVnd(data.revenue)}
          hint={`${data.orders.toLocaleString('vi-VN')} đơn${data.offline_orders > 0 ? ` · ${data.offline_orders} lúc mất mạng` : ''}`}
        />
        <Metric label="Trung bình mỗi đơn" value={formatVnd(avg)} hint={`${data.items.toLocaleString('vi-VN')} món đã bán`} />
        <Metric label="Đã giảm giá" value={formatVnd(data.discount)} />
        <Metric label="Cho thuê" value={formatVnd(data.rental_revenue)} hint={`${data.rentals.toLocaleString('vi-VN')} lượt thuê`} />
      </div>

      <Panel
        title="Món bán chạy"
        description={
          anyCost
            ? 'Theo doanh thu. Lãi gộp ước tính = doanh thu − số lượng × giá vốn hiện tại (món chưa nhập giá vốn để trống).'
            : 'Theo doanh thu. Nhập giá vốn ở Quản lý sản phẩm để xem lãi gộp ước tính.'
        }
      >
        <DataTable
          rows={data.top}
          rowKey={(r) => r.id}
          caption="Món bán chạy"
          columns={[
            {
              key: 'name',
              header: 'Món',
              cell: (r) => (
                <span>
                  <Link href={`/admin/catalog/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  {r.category && <span className="block text-xs text-muted">{r.category}</span>}
                </span>
              ),
            },
            {
              key: 'qty',
              header: 'Số lượng',
              align: 'right',
              cell: (r) => `${r.qty.toLocaleString('vi-VN')}${r.unit ? ` ${r.unit}` : ''}`,
            },
            { key: 'orders', header: 'Số đơn', align: 'right', wide: true, cell: (r) => r.orders.toLocaleString('vi-VN') },
            { key: 'revenue', header: 'Doanh thu', align: 'right', cell: (r) => formatVnd(r.revenue) },
            ...(anyCost
              ? [
                  {
                    key: 'profit',
                    header: 'Lãi gộp ước tính',
                    align: 'right' as const,
                    cell: (r: Data['top'][number]) => (r.cost === null ? '—' : formatVnd(r.revenue - r.cost)),
                  },
                ]
              : []),
          ]}
        />
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel title="Theo nhóm hàng">
          <HBarList
            color="var(--viz-sale)"
            rows={data.by_category.map((c) => ({
              key: c.name,
              label: c.name,
              value: Math.max(0, c.revenue),
              display: formatVnd(c.revenue),
            }))}
          />
        </Panel>
        <Panel title="Đồ cho thuê nhiều nhất">
          <HBarList
            color="var(--viz-rental)"
            rows={data.rental_top.map((r) => ({
              key: r.name,
              label: r.name,
              sub: `${r.rentals} lượt`,
              value: r.rentals,
              display: formatVnd(r.fee),
            }))}
            empty="Chưa có lượt thuê trong khoảng này."
          />
        </Panel>
      </div>

      <Panel
        title={`Hàng tồn không bán được (${data.slow_count.toLocaleString('vi-VN')})`}
        description="Món đang bày bán, còn hàng nhưng không bán được cái nào trong khoảng đã chọn — cân nhắc giảm giá, đổi chỗ trưng bày hoặc ngừng nhập."
        actions={
          data.low_stock > 0 ? (
            <Link href="/admin/inventory" className="text-sm text-primary hover:underline">
              {data.low_stock} món sắp hết hàng →
            </Link>
          ) : undefined
        }
      >
        <DataTable
          rows={data.slow}
          rowKey={(r, i) => `${r.name}-${r.variant ?? ''}-${r.branch}-${i}`}
          empty="Món nào còn hàng cũng bán được — tốt!"
          caption="Hàng tồn không bán được"
          columns={[
            {
              key: 'name',
              header: 'Món',
              cell: (r) => (
                <span>
                  {r.name}
                  {r.variant && <span className="text-muted"> ({r.variant})</span>}
                </span>
              ),
            },
            { key: 'branch', header: 'Chi nhánh', wide: true, cell: (r) => r.branch },
            { key: 'stock', header: 'Tồn', align: 'right', cell: (r) => r.on_hand.toLocaleString('vi-VN') },
            {
              key: 'last',
              header: 'Bán lần cuối',
              align: 'right',
              cell: (r) => (r.last_sold_at ? formatDate(r.last_sold_at) : 'Chưa bán'),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
