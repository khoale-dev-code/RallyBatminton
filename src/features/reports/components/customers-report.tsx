import Link from 'next/link';

import { Panel } from '@/components/ui/primitives';
import { formatDate, formatVnd } from '@/lib/format';

import { bookingSourceLabel, ratio } from '../lib/report';
import { type CustomersReport as Data } from '../queries';
import { HBarList, Metric } from './charts';
import { DataTable } from './data-table';

export function CustomersReport({ data }: { data: Data }) {
  const cancelRate = ratio(data.cancelled, data.total);
  const noShowRate = ratio(data.no_show, data.played);
  const sources = Object.entries(data.by_source).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Lượt đặt sân"
          value={data.total.toLocaleString('vi-VN')}
          hint={`${data.played.toLocaleString('vi-VN')} lượt giữ sân thật`}
        />
        <Metric
          label="Khách khác nhau"
          value={data.unique_customers.toLocaleString('vi-VN')}
          hint={`${data.new_customers} mới · ${data.returning_customers} quay lại`}
        />
        <Metric
          label="Hủy đơn"
          value={cancelRate === null ? '—' : `${cancelRate}%`}
          hint={`${data.cancelled} đơn hủy · ${data.expired_holds} giữ chỗ hết hạn`}
        />
        <Metric label="Không đến" value={noShowRate === null ? '—' : `${noShowRate}%`} hint={`${data.no_show} lượt`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Khách đặt từ 2 lần"
          value={data.repeat_customers.toLocaleString('vi-VN')}
          hint={data.unique_customers > 0 ? `${ratio(data.repeat_customers, data.unique_customers)}% số khách` : undefined}
        />
        <Metric
          label="Đặt online trước giờ chơi"
          value={data.lead_hours_median === null ? '—' : `${data.lead_hours_median.toLocaleString('vi-VN')} giờ`}
          hint="Trung vị — để biết nên mở đặt trước bao xa"
        />
        <Metric label="Thành viên mới" value={data.members_new.toLocaleString('vi-VN')} hint={`Tổng ${data.members_total} thành viên`} />
        <Metric
          label="Đơn không gắn khách"
          value={data.walk_in_bookings.toLocaleString('vi-VN')}
          hint="Đặt tại quầy không ghi số điện thoại"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_2fr]">
        <Panel title="Khách đặt qua đâu">
          <HBarList
            rows={sources.map(([s, n]) => ({
              key: s,
              label: bookingSourceLabel(s),
              value: n,
              display: `${n.toLocaleString('vi-VN')} · ${ratio(n, data.total) ?? 0}%`,
            }))}
          />
        </Panel>
        <Panel title="Khách đặt nhiều nhất" description="Theo số lượt giữ sân trong khoảng; tiền là số đã thu của các lượt đó.">
          <DataTable
            rows={data.top}
            rowKey={(r) => r.id}
            caption="Khách đặt nhiều nhất"
            columns={[
              {
                key: 'name',
                header: 'Khách',
                cell: (r) => (
                  <Link href={`/admin/customers/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                ),
              },
              { key: 'n', header: 'Lượt', align: 'right', cell: (r) => r.bookings.toLocaleString('vi-VN') },
              { key: 'spend', header: 'Đã thu', align: 'right', cell: (r) => formatVnd(r.spend) },
              { key: 'last', header: 'Lần gần nhất', align: 'right', wide: true, cell: (r) => formatDate(r.last_at) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
