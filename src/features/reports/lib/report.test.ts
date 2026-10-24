import { describe, expect, it } from 'vitest';

import {
  bucketRevenue,
  daysBetween,
  grainFor,
  heatGrid,
  heatLevel,
  occupancyPct,
  parseReportQuery,
  presetRange,
  rangeLabel,
  ratio,
  reportHref,
  weekdayAverages,
} from './report';

const TODAY = '2026-10-24'; // Thứ 7

describe('bộ lọc báo cáo', () => {
  it('mặc định 30 ngày, mục Doanh thu, mọi chi nhánh', () => {
    expect(parseReportQuery({}, TODAY)).toEqual({ tab: 'doanh-thu', from: '2026-09-25', to: TODAY, branch: null, preset: '30' });
  });
  it('kỳ có sẵn', () => {
    expect(presetRange('7', TODAY)).toEqual({ from: '2026-10-18', to: TODAY });
    expect(presetRange('thang-nay', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(presetRange('thang-truoc', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('thang-truoc', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('nam-nay', TODAY)).toEqual({ from: '2026-01-01', to: TODAY });
  });
  it('ngày tự chọn: đảo ngược, quá 366 ngày, giá trị lạ', () => {
    expect(parseReportQuery({ from: '2026-10-10', to: '2026-10-01', muc: 'ket-tien' }, TODAY)).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-10',
      tab: 'ket-tien',
      preset: null,
    });
    const long = parseReportQuery({ from: '2024-01-01', to: '2026-10-24' }, TODAY);
    expect(daysBetween(long.from, long.to)).toBe(366);
    expect(parseReportQuery({ from: 'x', to: '2026-13-40', muc: 'hack', branch: "1' or 1=1" }, TODAY)).toMatchObject({
      tab: 'doanh-thu',
      branch: null,
      preset: '30',
    });
    expect(parseReportQuery({ branch: '7E916D1D-A1F2-45C4-B4C3-3277FE77E9FE' }, TODAY).branch).toBe('7e916d1d-a1f2-45c4-b4c3-3277fe77e9fe');
  });
  it('liên kết giữ bộ lọc', () => {
    const q = parseReportQuery({ ky: '7', branch: '7e916d1d-a1f2-45c4-b4c3-3277fe77e9fe' }, TODAY);
    expect(reportHref('/admin/reports', q, { tab: 'lap-san' })).toBe(
      '/admin/reports?muc=lap-san&ky=7&branch=7e916d1d-a1f2-45c4-b4c3-3277fe77e9fe',
    );
    expect(reportHref('/x', { ...q, preset: null })).toBe(
      '/x?muc=doanh-thu&from=2026-10-18&to=2026-10-24&branch=7e916d1d-a1f2-45c4-b4c3-3277fe77e9fe',
    );
    expect(rangeLabel('2026-10-01', '2026-10-24')).toBe('01/10 – 24/10/2026');
    expect(rangeLabel('2026-10-24', '2026-10-24')).toBe('24/10/2026');
  });
});

describe('doanh thu theo ngày / tuần / tháng', () => {
  const series = [
    { day: '2026-10-18', booking: 100, sale: 10, rental: 1, refund: 0 }, // CN
    { day: '2026-10-19', booking: 200, sale: 20, rental: 2, refund: 5 }, // T2
    { day: '2026-10-20', booking: 300, sale: 30, rental: 3, refund: 0 },
    { day: '2026-11-02', booking: 50, sale: 0, rental: 0, refund: 0 },
  ];
  it('chọn độ chi tiết theo độ dài khoảng', () => {
    expect(grainFor(30)).toBe('day');
    expect(grainFor(90)).toBe('week');
    expect(grainFor(366)).toBe('month');
  });
  it('gộp tuần (bắt đầu thứ 2) và tháng', () => {
    const weeks = bucketRevenue(series, 'week');
    expect(weeks.map((w) => [w.key, w.booking, w.refund])).toEqual([
      ['2026-10-12', 100, 0],
      ['2026-10-19', 500, 5],
      ['2026-11-02', 50, 0],
    ]);
    const months = bucketRevenue(series, 'month');
    expect(months.map((m) => [m.label, m.booking])).toEqual([
      ['10/26', 600],
      ['11/26', 50],
    ]);
    expect(bucketRevenue(series, 'day')).toHaveLength(4);
  });
  it('trung bình theo thứ (trừ hoàn tiền)', () => {
    const avg = weekdayAverages(series);
    expect(avg[0]).toMatchObject({ label: 'Thứ 2', average: Math.round((217 + 50) / 2) });
    expect(avg[6]).toMatchObject({ label: 'Chủ nhật', average: 111 });
    expect(avg[3]?.average).toBe(0);
  });
});

describe('lấp sân', () => {
  it('tỷ lệ và mức màu', () => {
    expect(occupancyPct(30, 120)).toBe(25);
    expect(occupancyPct(200, 120)).toBe(100);
    expect(occupancyPct(5, 0)).toBeNull();
    expect([null, 0, 10, 25, 59, 60, 95].map((p) => heatLevel(p))).toEqual([0, 0, 1, 2, 3, 4, 5]);
    expect(ratio(1, 3)).toBe(33.3);
    expect(ratio(1, 0)).toBeNull();
  });
  it('lưới giờ và khung vắng nhất', () => {
    const g = heatGrid([
      { dow: 1, h: 6, booked: 0, capacity: 60 },
      { dow: 1, h: 18, booked: 60, capacity: 60 },
      { dow: 2, h: 6, booked: 30, capacity: 60 },
      { dow: 2, h: 18, booked: 45, capacity: 60 },
    ]);
    expect(g.hours).toEqual([6, 18]);
    expect(g.get(2, 18)?.booked).toBe(45);
    expect(g.get(3, 6)).toBeUndefined();
    expect(g.quietest.map((c) => `${c.dow}:${c.h}:${c.pct}`)).toEqual(['1:6:0', '2:6:50', '2:18:75', '1:18:100']);
  });
});
