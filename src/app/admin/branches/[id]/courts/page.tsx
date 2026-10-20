import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives';
import { createCourtAction } from '@/features/admin-branches/actions';
import { BranchTabs } from '@/features/admin-branches/components/branch-tabs';
import { getBranchCourts } from '@/features/admin-branches/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { COURT_STATUS } from '@/lib/labels';

export default async function BranchCourtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const [, data] = await withGuard(requireOwner(), () => getBranchCourts(id));
  if (!data) notFound();
  const { branch, courts, surfaces } = data;
  const surfaceLabel = Object.fromEntries(surfaces.map((s) => [s.code, s.label]));

  return (
    <>
      <PageHeader
        title={branch.name}
        back={
          <Link href="/admin/branches" className="text-sm text-muted hover:underline">
            Chi nhánh & sân
          </Link>
        }
      />
      <BranchTabs branchId={branch.id} active="courts" />
      {created && <Notice className="mb-6">Đã tạo chi nhánh. Thêm các sân, sau đó vào &quot;Bảng giá&quot; để đặt giá rồi công bố.</Notice>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {courts.length === 0 ? (
            <EmptyState title="Chưa có sân">Thêm sân đầu tiên bằng biểu mẫu bên cạnh.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
              {courts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/courts/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-hall/60 sm:px-6"
                  >
                    <div>
                      <p className="font-display text-xl">{c.name}</p>
                      <p className="text-sm text-muted">
                        {[
                          c.surface_code ? surfaceLabel[c.surface_code] : null,
                          c.is_indoor ? 'Trong nhà' : 'Ngoài trời',
                          `${c.court_photos.length} ảnh`,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                    <Badge tone={COURT_STATUS[c.status].tone}>{COURT_STATUS[c.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel title="Thêm sân">
          <ActionForm action={createCourtAction.bind(null, branch.id)} resetOnSuccess>
            <TextField name="name" label="Tên sân" placeholder={`Sân ${courts.length + 1}`} required />
            <SelectField
              name="surface_code"
              label="Mặt sân"
              placeholder="Chưa chọn"
              options={surfaces.map((s) => ({ value: s.code, label: s.label }))}
            />
            <TextField name="sort_order" label="Thứ tự hiển thị" type="number" min={0} defaultValue={courts.length + 1} />
            <CheckboxField name="is_indoor" label="Sân trong nhà" defaultChecked />
            <TextareaField name="description" label="Mô tả ngắn" optional rows={2} />
            <SubmitButton pendingLabel="Đang thêm…">Thêm sân</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
