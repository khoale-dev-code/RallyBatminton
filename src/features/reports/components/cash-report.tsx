import { ShieldAlert } from 'lucide-react';

import { Panel } from '@/components/ui/primitives';
import { formatDate, formatDateTime, formatTime, formatVnd } from '@/lib/format';

import { type CashReport as Data } from '../queries';
import { Metric } from './charts';
import { DataTable } from './data-table';

export function CashReport({ data }: { data: Data }) {
  const days = data.by_day.filter((d) => d.cash_in > 0 || d.cash_refund > 0).reverse();
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Tiền mặt thu"
          value={formatVnd(data.cash_in)}
          hint={data.cash_refund > 0 ? `Hoàn tiền mặt −${formatVnd(data.cash_refund)}` : undefined}
        />
        <Metric label="Tiền mặt ròng" value={formatVnd(data.cash_net)} hint="Phải có trong két (chưa tính tiền đầu ca)" />
        <Metric label="Không dùng tiền mặt" value={formatVnd(data.non_cash_net)} hint="Chuyển khoản, SePay, thẻ, ví" />
        <Metric
          label="Mở ngăn kéo"
          value={data.drawer.total.toLocaleString('vi-VN')}
          hint={`${data.drawer.manual} lần mở bằng tay`}
          tone={data.drawer.manual > 0 ? 'down' : undefined}
        />
      </div>
      {data.offline_sales > 0 && (
        <p className="rounded-control bg-amber-soft px-4 py-3 text-sm text-amber-deep">
          {data.offline_sales} đơn bán lúc mất mạng ({formatVnd(data.offline_total)}) — đã tính theo giờ bán thật.
        </p>
      )}

      <Panel
        title="Theo ca làm"
        description="Tiền mặt nhân viên ghi nhận trong giờ ca của mình (từ lúc chấm công vào tới lúc ra) — đối chiếu với tiền đếm được khi giao ca."
      >
        <DataTable
          rows={data.shifts}
          rowKey={(r) => r.id}
          limit={12}
          empty="Chưa có ca nào chấm công vào trong khoảng này."
          caption="Tiền mặt theo ca"
          columns={[
            {
              key: 'who',
              header: 'Nhân viên',
              cell: (r) => (
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">{r.branch}</span>
                </span>
              ),
            },
            {
              key: 'time',
              header: 'Ca',
              cell: (r) => (
                <span className="whitespace-nowrap tabular">
                  {formatDate(r.start)}
                  <span className="block text-xs text-muted">
                    {formatTime(r.start)}–{formatTime(r.end)}
                  </span>
                </span>
              ),
            },
            { key: 'cash', header: 'Tiền mặt thu', align: 'right', cell: (r) => formatVnd(r.cash_in) },
            {
              key: 'refund',
              header: 'Hoàn',
              align: 'right',
              wide: true,
              cell: (r) => (r.cash_refund > 0 ? `−${formatVnd(r.cash_refund)}` : '—'),
            },
            {
              key: 'manual',
              header: 'Mở tay',
              align: 'right',
              cell: (r) => (r.drawer_manual > 0 ? <span className="font-medium text-shuttle-deep">{r.drawer_manual}</span> : '0'),
            },
          ]}
        />
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-2">
        <Panel title="Theo thu ngân">
          <DataTable
            rows={data.by_cashier}
            rowKey={(r) => r.user_id}
            empty="Chưa có giao dịch do nhân viên ghi nhận."
            caption="Tiền mặt theo thu ngân"
            columns={[
              { key: 'name', header: 'Thu ngân', cell: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'cash', header: 'Tiền mặt', align: 'right', cell: (r) => formatVnd(r.cash_in - r.cash_refund) },
              { key: 'count', header: 'Lần thu', align: 'right', wide: true, cell: (r) => r.cash_count.toLocaleString('vi-VN') },
              { key: 'other', header: 'Khác', align: 'right', wide: true, cell: (r) => formatVnd(r.other_net) },
              {
                key: 'drawer',
                header: 'Ngăn kéo (tay)',
                align: 'right',
                cell: (r) => (
                  <span>
                    {r.drawer_auto + r.drawer_manual}
                    {r.drawer_manual > 0 && <span className="text-shuttle-deep"> ({r.drawer_manual})</span>}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Tiền mặt theo ngày">
          <DataTable
            rows={days}
            rowKey={(r) => r.day}
            empty="Chưa thu tiền mặt trong khoảng này."
            limit={14}
            caption="Tiền mặt theo ngày"
            columns={[
              { key: 'day', header: 'Ngày', cell: (r) => formatDate(`${r.day.slice(0, 10)}T12:00:00+07:00`) },
              { key: 'in', header: 'Thu', align: 'right', cell: (r) => formatVnd(r.cash_in) },
              { key: 'refund', header: 'Hoàn', align: 'right', cell: (r) => (r.cash_refund > 0 ? `−${formatVnd(r.cash_refund)}` : '—') },
              {
                key: 'net',
                header: 'Ròng',
                align: 'right',
                cell: (r) => <span className="font-medium">{formatVnd(r.cash_in - r.cash_refund)}</span>,
              },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Mở ngăn kéo bằng tay"
        description="Mỗi lần nhân viên bấm Mở ngăn kéo không kèm thu tiền (ứng dụng Windows). Nhiều lần mở tay không lý do là dấu hiệu cần kiểm tra."
      >
        {data.manual_opens.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldAlert className="size-4" aria-hidden />
            Không có lần mở tay nào.
          </p>
        ) : (
          <DataTable
            rows={data.manual_opens}
            rowKey={(r, i) => `${r.at}-${i}`}
            limit={12}
            caption="Mở ngăn kéo bằng tay"
            columns={[
              { key: 'at', header: 'Lúc', cell: (r) => <span className="whitespace-nowrap tabular">{formatDateTime(r.at)}</span> },
              { key: 'who', header: 'Ai mở', cell: (r) => r.name },
              { key: 'branch', header: 'Chi nhánh', wide: true, cell: (r) => r.branch },
              { key: 'note', header: 'Ghi chú', wide: true, cell: (r) => [r.ref, r.device].filter(Boolean).join(' · ') || '—' },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
