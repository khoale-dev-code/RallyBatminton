import { Panel } from '@/components/ui/primitives';
import { percentChange } from '@/features/dashboard/lib/metrics';
import { formatVnd } from '@/lib/format';

import { bucketRevenue, grainFor, paymentMethodLabel, weekdayAverages } from '../lib/report';
import { type RevenueReport as Data } from '../queries';
import { HBarList, Metric, RevenueBars, SourceSplit } from './charts';

const GRAIN_LABEL = { day: 'ngày', week: 'tuần', month: 'tháng' } as const;

export function RevenueReport({ data, allBranches }: { data: Data; allBranches: boolean }) {
  const change = percentChange(data.net, data.prev_net);
  const grain = grainFor(data.days);
  const bars = bucketRevenue(data.series, grain);
  const weekdays = weekdayAverages(data.series);
  const methods = Object.entries(data.by_method)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Thực thu"
          value={formatVnd(data.net)}
          hint={change === null ? 'Kỳ trước chưa có số liệu' : `${change >= 0 ? '+' : ''}${change}% so với ${data.days} ngày trước đó`}
          tone={change === null ? undefined : change >= 0 ? 'up' : 'down'}
        />
        <Metric label="Trung bình mỗi ngày" value={formatVnd(Math.round(data.net / Math.max(1, data.days)))} hint={`${data.days} ngày`} />
        <Metric label="Tổng tiền vào" value={formatVnd(data.charge)} hint={`${data.count.toLocaleString('vi-VN')} lần thu`} />
        <Metric label="Hoàn tiền" value={data.refund > 0 ? `−${formatVnd(data.refund)}` : formatVnd(0)} />
      </div>

      <Panel
        title={`Thực thu theo ${GRAIN_LABEL[grain]}`}
        description="Tiền đã nhận (tiền mặt, chuyển khoản, SePay…) theo ngày nhận tiền. Rê chuột / chạm vào cột để xem chi tiết."
      >
        <RevenueBars bars={bars} />
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel title="Tiền đến từ đâu">
          <SourceSplit parts={data.by_source} />
          <h3 className="mt-6 mb-3 text-sm font-medium">Theo hình thức thanh toán</h3>
          <HBarList
            rows={methods.map(([m, v]) => ({ key: m, label: paymentMethodLabel(m), value: Math.max(0, v), display: formatVnd(v) }))}
            color="var(--viz-booking)"
          />
        </Panel>
        <Panel title="Trung bình theo thứ" description="Thực thu trung bình một ngày — để biết ngày nào đông, ngày nào nên khuyến mãi.">
          <HBarList
            rows={weekdays.map((w) => ({
              key: String(w.dow),
              label: w.label,
              value: Math.max(0, w.average),
              display: formatVnd(w.average),
            }))}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {allBranches && data.by_branch.length > 1 && (
          <Panel title="Theo chi nhánh">
            <HBarList
              rows={data.by_branch.map((b) => ({
                key: b.id,
                label: b.name,
                sub: `sân ${formatVnd(b.booking)} · bán ${formatVnd(b.sale)} · thuê ${formatVnd(b.rental)}`,
                value: Math.max(0, b.net),
                display: formatVnd(b.net),
              }))}
            />
          </Panel>
        )}
        <Panel title="Tiền sân theo sân" description="Tiền đã thu của các đơn đặt sân, theo sân.">
          <HBarList
            rows={data.by_court.slice(0, 16).map((c) => ({
              key: c.id,
              label: c.name,
              sub: allBranches ? c.branch : undefined,
              value: Math.max(0, c.net),
              display: formatVnd(c.net),
            }))}
            empty="Chưa thu tiền sân trong khoảng này."
          />
        </Panel>
      </div>
    </div>
  );
}
