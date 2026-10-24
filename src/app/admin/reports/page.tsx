import '@/features/reports/reports.css';

import { type ReactNode } from 'react';

import { LinkTabs } from '@/components/ui/link-tabs';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/primitives';
import { CashReport } from '@/features/reports/components/cash-report';
import { CustomersReport } from '@/features/reports/components/customers-report';
import { OccupancyReport } from '@/features/reports/components/occupancy-report';
import { ProductsReport } from '@/features/reports/components/products-report';
import { ReportFilters } from '@/features/reports/components/report-filters';
import { RevenueReport } from '@/features/reports/components/revenue-report';
import { parseReportQuery, REPORT_TABS, reportHref } from '@/features/reports/lib/report';
import {
  getCashReport,
  getCustomersReport,
  getOccupancyReport,
  getProductsReport,
  getRevenueReport,
  listReportBranches,
  type ReportResult,
} from '@/features/reports/queries';
import { requireOwner } from '@/lib/auth/guards';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Báo cáo' };

function Failed({ result }: { result: Extract<ReportResult<unknown>, { ok: false }> }) {
  return (
    <Notice tone="warning" title={result.notInstalled ? 'Chưa cài báo cáo' : 'Không tải được báo cáo'}>
      {result.notInstalled
        ? 'Chạy supabase/sql/27_owner_reports.sql trong Supabase SQL Editor (docs/HUONG-DAN-KY-THUAT.md mục 28).'
        : result.error}
    </Notice>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const q = parseReportQuery(await searchParams, todayKey());
  const branches = await listReportBranches();
  const allBranches = q.branch === null;

  let body: ReactNode = null;
  switch (q.tab) {
    case 'doanh-thu': {
      const r = await getRevenueReport(q.from, q.to, q.branch);
      body = r.ok ? <RevenueReport data={r.data} allBranches={allBranches} /> : <Failed result={r} />;
      break;
    }
    case 'lap-san': {
      const r = await getOccupancyReport(q.from, q.to, q.branch);
      body = r.ok ? <OccupancyReport data={r.data} allBranches={allBranches} /> : <Failed result={r} />;
      break;
    }
    case 'khach': {
      const r = await getCustomersReport(q.from, q.to, q.branch);
      body = r.ok ? <CustomersReport data={r.data} /> : <Failed result={r} />;
      break;
    }
    case 'hang-hoa': {
      const r = await getProductsReport(q.from, q.to, q.branch);
      body = r.ok ? <ProductsReport data={r.data} /> : <Failed result={r} />;
      break;
    }
    case 'ket-tien': {
      const r = await getCashReport(q.from, q.to, q.branch);
      body = r.ok ? <CashReport data={r.data} /> : <Failed result={r} />;
      break;
    }
  }

  return (
    <div className="rally-report">
      <PageHeader
        title="Báo cáo"
        description="Doanh thu, lấp sân, khách hàng, hàng hóa và két tiền theo khoảng thời gian — chỉ chủ sân xem được."
      />
      <div className="report-tabs">
        <LinkTabs
          label="Mục báo cáo"
          tabs={REPORT_TABS.map((t) => ({
            href: reportHref('/admin/reports', q, { tab: t.key }),
            label: t.label,
            active: q.tab === t.key,
          }))}
        />
      </div>
      <ReportFilters q={q} branches={branches} />
      {body}
    </div>
  );
}
