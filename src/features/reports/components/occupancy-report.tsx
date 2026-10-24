import { Lightbulb } from 'lucide-react';

import { Panel } from '@/components/ui/primitives';

import { formatHours, heatGrid, occupancyPct, WEEKDAY_LONG } from '../lib/report';
import { type OccupancyReport as Data } from '../queries';
import { HBarList, Metric, OccupancyHeatmap } from './charts';

export function OccupancyReport({ data, allBranches }: { data: Data; allBranches: boolean }) {
  const pct = occupancyPct(data.booked_minutes, data.capacity_minutes);
  const free = Math.max(0, data.capacity_minutes - data.booked_minutes);
  const { quietest } = heatGrid(data.heatmap);
  const busiest = [...data.heatmap]
    .map((c) => ({ ...c, pct: occupancyPct(c.booked, c.capacity) ?? 0 }))
    .sort((a, b) => b.pct - a.pct || a.dow - b.dow || a.h - b.h)
    .slice(0, 5);
  const slot = (c: { dow: number; h: number; pct: number }) => `${WEEKDAY_LONG[c.dow - 1] ?? ''} ${c.h}:00–${c.h + 1}:00 (${c.pct}%)`;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Lấp sân" value={pct === null ? '—' : `${pct}%`} hint={`${data.courts} sân đang hoạt động`} />
        <Metric
          label="Giờ sân đã bán"
          value={formatHours(data.booked_minutes)}
          hint={`${data.bookings.toLocaleString('vi-VN')} lượt đặt`}
        />
        <Metric label="Giờ sân còn trống" value={formatHours(free)} hint="Trong giờ mở cửa" />
        <Metric
          label="Trung bình mỗi lượt"
          value={data.bookings > 0 ? formatHours(Math.round(data.booked_minutes / data.bookings)) : '—'}
        />
      </div>

      <Panel
        title="Kín sân theo thứ và giờ"
        description="Đậm = gần kín, nhạt = còn trống nhiều. Tính đơn đã xác nhận / đang chơi / đã xong / khách không đến (sân đã giữ)."
      >
        <OccupancyHeatmap cells={data.heatmap} />
      </Panel>

      {quietest.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Panel title="Khung giờ vắng nhất">
            <ul className="flex flex-col gap-1.5 text-sm">
              {quietest.map((c) => (
                <li key={`${c.dow}-${c.h}`}>{slot(c)}</li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2 rounded-control bg-hall px-3 py-2 text-sm text-muted">
              <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
              Gợi ý: giảm giá giờ vắng (Bảng giá theo giờ ở Chi nhánh &amp; sân), mở lớp tập / thuê sân cố định cho nhóm vào các khung này.
            </p>
          </Panel>
          <Panel title="Khung giờ kín nhất">
            <ul className="flex flex-col gap-1.5 text-sm">
              {busiest.map((c) => (
                <li key={`${c.dow}-${c.h}`}>{slot(c)}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Khung kín thường xuyên: có thể tăng giá giờ cao điểm hoặc ưu tiên khách đặt định kỳ.</p>
          </Panel>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel title="Theo sân">
          <HBarList
            max={100}
            rows={data.by_court.map((c) => {
              const p = occupancyPct(c.booked, c.capacity) ?? 0;
              return {
                key: c.id,
                label: c.name,
                sub: `${allBranches ? `${c.branch} · ` : ''}${c.bookings} lượt`,
                value: p,
                display: `${p}%`,
              };
            })}
          />
        </Panel>
        {allBranches && data.by_branch.length > 1 && (
          <Panel title="Theo chi nhánh">
            <HBarList
              max={100}
              rows={data.by_branch.map((b) => {
                const p = occupancyPct(b.booked, b.capacity) ?? 0;
                return { key: b.id, label: b.name, sub: formatHours(b.booked), value: p, display: `${p}%` };
              })}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
