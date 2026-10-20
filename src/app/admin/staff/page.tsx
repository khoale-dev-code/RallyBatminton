import Link from 'next/link';

import { LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { listStaff } from '@/features/admin-staff/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { formatPhone } from '@/lib/format';
import { EMPLOYMENT_TYPE } from '@/lib/labels';

export const metadata = { title: 'Nhân viên' };

export default async function StaffPage() {
  const [, { employees, owners }] = await withGuard(requireOwner(), () => listStaff());
  return (
    <>
      <PageHeader
        title="Nhân viên"
        description="Hồ sơ nhân sự tách khỏi tài khoản đăng nhập. Quyền được cấp riêng từng chi nhánh."
        actions={
          <LinkButton href="/admin/staff/new" variant="primary">
            Thêm nhân viên
          </LinkButton>
        }
      />
      <div className="flex flex-col gap-6">
        {employees.length === 0 ? (
          <EmptyState title="Chưa có nhân viên" action={<LinkButton href="/admin/staff/new">Thêm nhân viên đầu tiên</LinkButton>} />
        ) : (
          <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
            {employees.map((e) => {
              const acc = e.staff_accounts;
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/staff/${e.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-hall/60 sm:px-6"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {e.full_name} <span className="text-sm font-normal text-muted tabular">{e.code}</span>
                      </span>
                      <span className="text-sm text-muted">
                        {[e.branches?.name, EMPLOYMENT_TYPE[e.employment_type], e.phone ? formatPhone(e.phone) : null]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-2">
                      {e.status === 'inactive' && <Badge>Đã nghỉ</Badge>}
                      {!acc ? (
                        <Badge tone="amber">Chưa có tài khoản</Badge>
                      ) : !acc.is_active ? (
                        <Badge tone="red">Tài khoản bị khóa</Badge>
                      ) : acc.must_change_password ? (
                        <Badge tone="amber">Chờ đổi mật khẩu</Badge>
                      ) : (
                        <Badge tone="green">Đang hoạt động</Badge>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Panel title="Chủ sân" description="Toàn quyền mọi chi nhánh. Hệ thống luôn giữ ít nhất một chủ sân đang hoạt động.">
          <ul className="flex flex-col gap-2">
            {owners.map((o) => (
              <li key={o.user_id} className="flex items-center justify-between gap-2">
                <span>{o.display_name}</span>
                {!o.is_active && <Badge>Đã khóa</Badge>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
