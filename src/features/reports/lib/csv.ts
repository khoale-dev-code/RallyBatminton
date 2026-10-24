import { toCsv } from '@/features/payroll/lib/csv';

import { type CashReport, type CustomersReport, type OccupancyReport, type ProductsReport, type RevenueReport } from '../queries';
import { bookingSourceLabel, occupancyPct, paymentMethodLabel, WEEKDAY_LONG } from './report';

/** File CSV (mở bằng Excel) cho từng mục báo cáo. Mỗi file: phần tổng + bảng chi tiết, cách nhau một dòng trống. */

type Cell = string | number | null | undefined;

function sections(...parts: Array<{ header: string[]; rows: Cell[][] }>): string {
  return parts
    .map((p, i) => {
      const csv = toCsv(p.header, p.rows);
      return i === 0 ? csv : csv.replace(/^﻿/, '');
    })
    .join('\r\n');
}

const day = (d: string) => d.slice(0, 10);

export function revenueCsv(r: RevenueReport): string {
  return sections(
    {
      header: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Từ ngày', r.from],
        ['Đến ngày', r.to],
        ['Thực thu', r.net],
        ['Tổng tiền vào', r.charge],
        ['Hoàn tiền', r.refund],
        ['Kỳ trước (thực thu)', r.prev_net],
        ['Tiền sân', r.by_source.booking],
        ['Bán hàng', r.by_source.sale],
        ['Cho thuê', r.by_source.rental],
        ...Object.entries(r.by_method).map(([m, v]): Cell[] => [`Hình thức: ${paymentMethodLabel(m)}`, v]),
      ],
    },
    {
      header: ['Ngày', 'Tiền sân', 'Bán hàng', 'Cho thuê', 'Hoàn tiền', 'Thực thu'],
      rows: r.series.map((s) => [day(s.day), s.booking, s.sale, s.rental, s.refund, s.booking + s.sale + s.rental - s.refund]),
    },
    {
      header: ['Chi nhánh', 'Tiền sân', 'Bán hàng', 'Cho thuê', 'Thực thu'],
      rows: r.by_branch.map((b) => [b.name, b.booking, b.sale, b.rental, b.net]),
    },
    { header: ['Sân', 'Chi nhánh', 'Tiền sân đã thu'], rows: r.by_court.map((c) => [c.name, c.branch, c.net]) },
  );
}

export function occupancyCsv(r: OccupancyReport): string {
  return sections(
    {
      header: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Từ ngày', r.from],
        ['Đến ngày', r.to],
        ['Lấp sân (%)', occupancyPct(r.booked_minutes, r.capacity_minutes)],
        ['Giờ sân đã bán', Math.round(r.booked_minutes / 6) / 10],
        ['Giờ sân mở cửa', Math.round(r.capacity_minutes / 6) / 10],
        ['Lượt đặt', r.bookings],
      ],
    },
    {
      header: ['Thứ', 'Giờ', 'Giờ đã bán', 'Giờ mở cửa', 'Lấp (%)'],
      rows: r.heatmap.map((c) => [
        WEEKDAY_LONG[c.dow - 1],
        `${c.h}:00`,
        Math.round(c.booked / 6) / 10,
        Math.round(c.capacity / 6) / 10,
        occupancyPct(c.booked, c.capacity),
      ]),
    },
    {
      header: ['Sân', 'Chi nhánh', 'Lượt đặt', 'Giờ đã bán', 'Lấp (%)'],
      rows: r.by_court.map((c) => [c.name, c.branch, c.bookings, Math.round(c.booked / 6) / 10, occupancyPct(c.booked, c.capacity)]),
    },
  );
}

export function customersCsv(r: CustomersReport): string {
  return sections(
    {
      header: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Từ ngày', r.from],
        ['Đến ngày', r.to],
        ['Lượt đặt', r.total],
        ['Lượt giữ sân thật', r.played],
        ['Hủy', r.cancelled],
        ['Không đến', r.no_show],
        ['Giữ chỗ hết hạn', r.expired_holds],
        ['Khách khác nhau', r.unique_customers],
        ['Khách mới', r.new_customers],
        ['Khách quay lại', r.returning_customers],
        ['Khách đặt từ 2 lần', r.repeat_customers],
        ['Đặt online trước giờ chơi (giờ, trung vị)', r.lead_hours_median],
        ['Thành viên mới', r.members_new],
        ...Object.entries(r.by_source).map(([s, n]): Cell[] => [`Nguồn: ${bookingSourceLabel(s)}`, n]),
      ],
    },
    { header: ['Khách', 'Lượt', 'Đã thu', 'Lần gần nhất'], rows: r.top.map((t) => [t.name, t.bookings, t.spend, day(t.last_at)]) },
  );
}

export function productsCsv(r: ProductsReport): string {
  return sections(
    {
      header: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Từ ngày', r.from],
        ['Đến ngày', r.to],
        ['Doanh thu bán hàng', r.revenue],
        ['Số đơn', r.orders],
        ['Số món', r.items],
        ['Giảm giá', r.discount],
        ['Đơn bán lúc mất mạng', r.offline_orders],
        ['Lượt thuê', r.rentals],
        ['Tiền cho thuê', r.rental_revenue],
      ],
    },
    {
      header: ['Món', 'Nhóm', 'Số lượng', 'Đơn vị', 'Số đơn', 'Doanh thu', 'Giá vốn ước tính'],
      rows: r.top.map((t) => [t.name, t.category, t.qty, t.unit, t.orders, t.revenue, t.cost]),
    },
    { header: ['Nhóm hàng', 'Số lượng', 'Doanh thu'], rows: r.by_category.map((c) => [c.name, c.qty, c.revenue]) },
    {
      header: ['Hàng tồn không bán được', 'Biến thể', 'Chi nhánh', 'Tồn', 'Bán lần cuối'],
      rows: r.slow.map((s) => [s.name, s.variant, s.branch, s.on_hand, s.last_sold_at ? day(s.last_sold_at) : '']),
    },
  );
}

export function cashCsv(r: CashReport): string {
  return sections(
    {
      header: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Từ ngày', r.from],
        ['Đến ngày', r.to],
        ['Tiền mặt thu', r.cash_in],
        ['Hoàn tiền mặt', r.cash_refund],
        ['Tiền mặt ròng', r.cash_net],
        ['Không dùng tiền mặt', r.non_cash_net],
        ['Mở ngăn kéo', r.drawer.total],
        ['Mở ngăn kéo bằng tay', r.drawer.manual],
        ['Đơn bán lúc mất mạng', r.offline_sales],
      ],
    },
    {
      header: ['Ngày', 'Tiền mặt thu', 'Hoàn', 'Ròng'],
      rows: r.by_day.map((d) => [day(d.day), d.cash_in, d.cash_refund, d.cash_in - d.cash_refund]),
    },
    {
      header: ['Nhân viên', 'Chi nhánh', 'Vào ca', 'Ra ca', 'Tiền mặt thu', 'Hoàn', 'Mở ngăn kéo tay'],
      rows: r.shifts.map((s) => [s.name, s.branch, s.start, s.end, s.cash_in, s.cash_refund, s.drawer_manual]),
    },
    {
      header: ['Thu ngân', 'Tiền mặt thu', 'Hoàn', 'Lần thu', 'Thu khác', 'Mở ngăn kéo tự động', 'Mở tay', 'Đơn bán lúc mất mạng'],
      rows: r.by_cashier.map((c) => [
        c.name,
        c.cash_in,
        c.cash_refund,
        c.cash_count,
        c.other_net,
        c.drawer_auto,
        c.drawer_manual,
        c.offline_sales,
      ]),
    },
    {
      header: ['Mở tay lúc', 'Ai mở', 'Chi nhánh', 'Ghi chú', 'Máy'],
      rows: r.manual_opens.map((m) => [m.at, m.name, m.branch, m.ref, m.device]),
    },
  );
}
