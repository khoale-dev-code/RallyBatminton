import Link from 'next/link';

import { LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { listAllBranches } from '@/features/admin-branches/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { BRANCH_STATUS } from '@/lib/labels';
import { shortTime } from '@/lib/time';

export const metadata = { title: 'Chi nhánh & sân' };

export default async function AdminBranchesPage() {
  const [, branches] = await withGuard(requireOwner(), () => listAllBranches());
  return (
    <>
      <PageHeader
        title="Chi nhánh & sân"
        description="Chi nhánh mới ở trạng thái bản nháp. Thêm sân và bảng giá rồi công bố để khách đặt."
        actions={
          <LinkButton href="/admin/branches/new" variant="primary">
            Thêm chi nhánh
          </LinkButton>
        }
      />
      {branches.length === 0 ? (
        <EmptyState
          title="Chưa có chi nhánh"
          action={
            <LinkButton href="/admin/branches/new" variant="primary">
              Thêm chi nhánh đầu tiên
            </LinkButton>
          }
        />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
          {branches.map((b) => {
            const status = BRANCH_STATUS[b.status];
            const active = b.courts.filter((c) => c.status === 'active').length;
            return (
              <li key={b.id}>
                <Link
                  href={`/admin/branches/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-hall/60 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-display text-xl">{b.name}</p>
                    <p className="text-sm text-muted">
                      {b.address_line}
                      {b.district ? `, ${b.district}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="tabular text-muted">
                      {shortTime(b.opens_at)}–{shortTime(b.closes_at)}
                    </span>
                    <span>{active} sân hoạt động</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
