import Link from 'next/link';

import { ActionForm, CheckboxField, SubmitButton, TextField } from '@/components/ui/form';
import { Badge, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import { createCategoryAction, updateCategoryAction } from '@/features/admin-catalog/actions';
import { listCategoriesAdmin } from '@/features/admin-catalog/queries';
import { requireOwner } from '@/lib/auth/guards';

export const metadata = { title: 'Nhóm sản phẩm' };

export default async function CategoriesPage() {
  await requireOwner();
  const categories = await listCategoriesAdmin();
  return (
    <>
      <PageHeader
        title="Nhóm sản phẩm"
        description="Dùng để lọc trên website và quầy bán. Ẩn nhóm không xóa sản phẩm bên trong."
        back={
          <Link href="/admin/catalog" className="text-sm text-muted hover:underline">
            Quản lý sản phẩm
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="flex flex-col gap-3">
          {categories.map((c) => (
            <li key={c.id}>
              <Disclosure
                summary={
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {!c.is_active && <Badge>Đang ẩn</Badge>}
                  </span>
                }
              >
                <ActionForm action={updateCategoryAction.bind(null, c.id)}>
                  <TextField name="name" label="Tên nhóm" defaultValue={c.name} required />
                  <TextField name="slug" label="Đường dẫn" defaultValue={c.slug} optional />
                  <TextField name="sort_order" label="Thứ tự" type="number" min={0} defaultValue={c.sort_order} />
                  <CheckboxField name="is_active" label="Đang dùng" defaultChecked={c.is_active} />
                  <SubmitButton size="sm">Lưu nhóm</SubmitButton>
                </ActionForm>
              </Disclosure>
            </li>
          ))}
        </ul>
        <Panel title="Thêm nhóm">
          <ActionForm action={createCategoryAction} resetOnSuccess>
            <TextField name="name" label="Tên nhóm" required />
            <TextField name="slug" label="Đường dẫn" optional hint="Bỏ trống để tạo tự động từ tên." />
            <TextField name="sort_order" label="Thứ tự" type="number" min={0} defaultValue={categories.length + 1} />
            <SubmitButton>Thêm nhóm</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
