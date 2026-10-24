import { Download } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { controlClass } from '@/components/ui/form';
import { cn } from '@/lib/cn';

import { REPORT_PRESETS, rangeLabel, reportHref, type ReportQuery } from '../lib/report';

const BASE = '/admin/reports';

/** Bộ lọc báo cáo: kỳ có sẵn + khoảng ngày tự chọn + chi nhánh. Form GET — chạy cả khi tắt JavaScript. */
export function ReportFilters({ q, branches }: { q: ReportQuery; branches: Array<{ id: string; name: string }> }) {
  return (
    <div className="report-filters mb-6 flex flex-col gap-3 rounded-panel border border-line bg-paper p-3 sm:p-4">
      <nav aria-label="Kỳ báo cáo" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {REPORT_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={reportHref(BASE, q, { preset: p.key })}
            aria-current={q.preset === p.key ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap',
              q.preset === p.key ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink',
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form method="get" action={BASE} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="muc" value={q.tab} />
        <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
          Từ ngày
          <input type="date" name="from" defaultValue={q.from} required className={cn(controlClass, 'min-h-10')} />
        </label>
        <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
          Đến ngày
          <input type="date" name="to" defaultValue={q.to} required className={cn(controlClass, 'min-h-10')} />
        </label>
        {branches.length > 1 && (
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
            Chi nhánh
            <select name="branch" defaultValue={q.branch ?? ''} className={cn(controlClass, 'min-h-10 pr-8')}>
              <option value="">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className={buttonClass('primary', 'md', 'min-h-10')}>
          Xem
        </button>
        <a
          href={reportHref(`${BASE}/export`, q)}
          className={buttonClass('outline', 'md', 'min-h-10 sm:ml-auto')}
          download
          title="Tải file CSV mở được bằng Excel"
        >
          <Download className="size-4" aria-hidden />
          Xuất Excel
        </a>
      </form>
      <p className="text-xs text-muted">
        Đang xem {rangeLabel(q.from, q.to)}
        {q.branch
          ? ` · ${branches.find((b) => b.id === q.branch)?.name ?? 'chi nhánh đã chọn'}`
          : branches.length > 1
            ? ' · tất cả chi nhánh'
            : ''}
      </p>
    </div>
  );
}
