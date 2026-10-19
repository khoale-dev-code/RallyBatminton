import Link from 'next/link';

import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { createBranchAction } from '@/features/admin-branches/actions';
import { requireOwner } from '@/lib/auth/guards';

export const metadata = { title: 'Thêm chi nhánh' };

export default async function NewBranchPage() {
  await requireOwner();
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Thêm chi nhánh"
        back={
          <Link href="/admin/branches" className="text-sm text-muted hover:underline">
            Chi nhánh & sân
          </Link>
        }
      />
      <Panel>
        <ActionForm action={createBranchAction}>
          <TextField name="name" label="Tên chi nhánh" placeholder="Rally Thủ Đức" required />
          <TextField name="slug" label="Đường dẫn trên website" optional hint="Để trống sẽ tự tạo từ tên, ví dụ rally-thu-duc." />
          <TextField name="address_line" label="Số nhà, đường" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="ward" label="Phường/xã" optional />
            <TextField name="district" label="Quận/huyện" optional />
          </div>
          <TextField name="city" label="Tỉnh/thành phố" defaultValue="TP. Hồ Chí Minh" required />
          <TextField name="phone" label="Số điện thoại chi nhánh" type="tel" optional />
          <SubmitButton pendingLabel="Đang tạo…">Tạo chi nhánh (bản nháp)</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
