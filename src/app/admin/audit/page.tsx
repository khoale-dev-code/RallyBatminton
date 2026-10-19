import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { AUDIT_TABLES, changedFields, listAuditEvents, PAGE_SIZE } from '@/features/audit/queries';
import { requireOwner } from '@/lib/auth/guards';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Nhật ký thay đổi' };

const ACTION_LABEL: Record<string, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  INSERT: { label: 'Tạo', tone: 'green' },
  UPDATE: { label: 'Sửa', tone: 'amber' },
  DELETE: { label: 'Xóa', tone: 'red' },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; page?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const page = Math.max(0, Math.min(200, Number(sp.page) || 0));
  const table = sp.table && sp.table in AUDIT_TABLES ? sp.table : undefined;
  const { events, count } = await listAuditEvents({ table, page });
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(table ? { table } : {}), page: String(p) }).toString()}`;

  return (
    <>
      <PageHeader title="Nhật ký thay đổi" description="Ghi tự động bởi database cho dữ liệu quan trọng; không ai sửa hay xóa được." />
      <form action="/admin/audit" className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="table" className="sr-only">
          Loại dữ liệu
        </label>
        <select id="table" name="table" defaultValue={table ?? ''} className="min-h-11 rounded-control border border-line bg-paper px-3">
          <option value="">Tất cả dữ liệu</option>
          {Object.entries(AUDIT_TABLES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass('outline')}>
          Lọc
        </button>
      </form>
      {events.length === 0 ? (
        <EmptyState title="Chưa có thay đổi" />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
          {events.map((e) => {
            const fields = e.action === 'UPDATE' ? changedFields(e.old_data, e.new_data) : [];
            const act = ACTION_LABEL[e.action] ?? { label: e.action, tone: 'amber' as const };
            return (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:px-6">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={act.tone}>{act.label}</Badge>
                  <span className="font-medium">{AUDIT_TABLES[e.table_name] ?? e.table_name}</span>
                  <span className="text-sm text-muted">{formatDateTime(e.occurred_at)}</span>
                </span>
                <span className="text-sm">
                  {e.actorName}
                  {e.reason ? `: ${e.reason}` : ''}
                </span>
                {fields.length > 0 && <span className="text-sm break-words text-muted">Trường đổi: {fields.join(', ')}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        {page > 0 && (
          <Link href={href(page - 1)} className={buttonClass('outline', 'sm')}>
            Mới hơn
          </Link>
        )}
        {(page + 1) * PAGE_SIZE < count && (
          <Link href={href(page + 1)} className={buttonClass('outline', 'sm')}>
            Cũ hơn
          </Link>
        )}
      </div>
    </>
  );
}
