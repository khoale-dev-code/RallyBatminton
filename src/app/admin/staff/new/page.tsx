import Link from 'next/link';

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { generateTempPassword } from '@/features/admin-staff/accounts';
import { createEmployeeAction } from '@/features/admin-staff/actions';
import { listBranchesForSelect, suggestEmployeeCode } from '@/features/admin-staff/queries';
import { requireOwner } from '@/lib/auth/guards';
import { EMPLOYMENT_TYPE } from '@/lib/labels';
import { todayKey } from '@/lib/time';

export const metadata = { title: 'Thêm nhân viên' };

export default async function NewStaffPage() {
  await requireOwner();
  const [branches, code] = await Promise.all([listBranchesForSelect(), suggestEmployeeCode()]);
  return (
    <>
      <PageHeader
        title="Thêm nhân viên"
        back={
          <Link href="/admin/staff" className="text-sm text-muted hover:underline">
            Nhân viên
          </Link>
        }
      />
      <Panel className="max-w-xl">
        <ActionForm action={createEmployeeAction}>
          <TextField name="full_name" label="Họ tên" required maxLength={120} autoComplete="off" />
          <TextField name="code" label="Mã nhân viên" defaultValue={code} required autoCapitalize="characters" />
          <SelectField
            name="home_branch_id"
            label="Chi nhánh chính"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            required
          />
          <SelectField
            name="employment_type"
            label="Hình thức"
            defaultValue="part_time"
            options={Object.entries(EMPLOYMENT_TYPE).map(([value, label]) => ({ value, label }))}
          />
          <TextField name="phone" label="Số điện thoại" inputMode="tel" optional autoComplete="off" />
          <TextField name="email" label="Email" type="email" optional autoComplete="off" hint="Dùng để đăng nhập nếu tạo tài khoản." />
          <TextField name="hired_on" label="Ngày vào làm" type="date" defaultValue={todayKey()} optional />
          <TextareaField name="notes" label="Ghi chú" optional rows={2} />

          <fieldset className="flex flex-col gap-4 rounded-control border border-line p-4">
            <legend className="px-1 font-medium">Tài khoản đăng nhập</legend>
            <CheckboxField name="create_account" label="Tạo tài khoản ngay" defaultChecked />
            <CheckboxField name="login_by_phone" label="Cho phép đăng nhập bằng số điện thoại" defaultChecked />
            <TextField
              name="password"
              label="Mật khẩu tạm"
              defaultValue={generateTempPassword()}
              autoComplete="off"
              hint="Gửi cho nhân viên; họ phải đổi ở lần đăng nhập đầu."
            />
          </fieldset>
          <SubmitButton pendingLabel="Đang tạo…">Tạo nhân viên</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
