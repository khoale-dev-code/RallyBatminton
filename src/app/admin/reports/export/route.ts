import { NextResponse, type NextRequest } from 'next/server';

import { cashCsv, customersCsv, occupancyCsv, productsCsv, revenueCsv } from '@/features/reports/lib/csv';
import { parseReportQuery } from '@/features/reports/lib/report';
import {
  getCashReport,
  getCustomersReport,
  getOccupancyReport,
  getProductsReport,
  getRevenueReport,
  type ReportResult,
} from '@/features/reports/queries';
import { getStaffContext } from '@/lib/auth/context';
import { todayKey } from '@/lib/time';

/** Xuất báo cáo đang xem ra CSV (UTF-8 BOM — Excel đọc đúng tiếng Việt). Chỉ chủ sân; database kiểm lại. */
export async function GET(request: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || ctx.role !== 'owner' || !ctx.isActive) return new NextResponse('Forbidden', { status: 403 });
  const q = parseReportQuery(Object.fromEntries(request.nextUrl.searchParams), todayKey());

  const build = async (): Promise<ReportResult<string>> => {
    const wrap = <T>(r: ReportResult<T>, fn: (d: T) => string): ReportResult<string> => (r.ok ? { ok: true, data: fn(r.data) } : r);
    switch (q.tab) {
      case 'doanh-thu':
        return wrap(await getRevenueReport(q.from, q.to, q.branch), revenueCsv);
      case 'lap-san':
        return wrap(await getOccupancyReport(q.from, q.to, q.branch), occupancyCsv);
      case 'khach':
        return wrap(await getCustomersReport(q.from, q.to, q.branch), customersCsv);
      case 'hang-hoa':
        return wrap(await getProductsReport(q.from, q.to, q.branch), productsCsv);
      case 'ket-tien':
        return wrap(await getCashReport(q.from, q.to, q.branch), cashCsv);
    }
  };
  const res = await build();
  if (!res.ok) return new NextResponse(res.notInstalled ? 'Chưa chạy 27_owner_reports.sql' : res.error, { status: 400 });
  return new NextResponse(res.data, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bao-cao-${q.tab}-${q.from}-${q.to}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
