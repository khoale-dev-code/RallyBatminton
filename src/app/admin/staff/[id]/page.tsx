import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionButton } from '@/components/ui/action-button';
import { ActionForm, SelectField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, DescriptionList, Disclosure, PageHeader, Panel } from '@/components/ui/primitives';
import { ACCOUNT_ERRORS, generateTempPassword, isAccountErrorCode, isAliasEmail } from '@/features/admin-staff/accounts';
import {
  addPayRateAction,
  createAccountAction,
  deletePayRateAction,
  resetPasswordAction,
  setAccountActiveAction,
  setEmployeeStatusAction,
  setPermissionsAction,
  updateEmployeeAction,
} from '@/features/admin-staff/actions';
import { PermissionMatrix } from '@/features/admin-staff/components/permission-matrix';
import { getStaffMember } from '@/features/admin-staff/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { formatDate, formatDateKey, formatMinutes, formatPhone, formatVnd } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { EMPLOYMENT_TYPE, PAY_TYPE } from '@/lib/labels';
import { todayKey } from '@/lib/time';

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ account_error?: string }>;
}) {
  const [{ id }, { account_error: accountError }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [, data] = await withGuard(requireOwner(), () => getStaffMember(id));
  if (!data) notFound();
  const { employee: e, account, loginEmail, rates, perms, branches } = data;
  const active = e.status === 'active';
  const currentRate = rates.find((r) => r.effective_from <= todayKey());

  return (
    <>
      <PageHeader
        title={e.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {e.code}, {e.branches?.name}
            {active ? (
              <Badge tone="green">Đang làm</Badge>
            ) : (
              <Badge>Đã nghỉ{e.terminated_on ? ` từ ${formatDate(e.terminated_on)}` : ''}</Badge>
            )}
          </span>
        }
        back={
          <Link href="/admin/staff" className="text-sm text-muted hover:underline">
            Nhân viên
          </Link>
        }
        actions={
          active ? (
            <ActionButton
              action={setEmployeeStatusAction.bind(null, e.id, false)}
              label="Cho nghỉ việc"
              variant="danger"
              confirmMessage="Cho nhân viên nghỉ việc? Tài khoản sẽ bị khóa; lịch sử công và lương vẫn giữ."
            />
          ) : (
            <ActionButton action={setEmployeeStatusAction.bind(null, e.id, true)} label="Kích hoạt lại" />
          )
        }
      />
      {isAccountErrorCode(accountError) && !account && (
        <div className="mb-6">
          <Notice tone="warning" title="Đã lưu hồ sơ nhưng chưa tạo được tài khoản">
            {ACCOUNT_ERRORS[accountError]}
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Tài khoản đăng nhập">
            {account ? (
              <div className="flex flex-col gap-4">
                <DescriptionList
                  items={[
                    { label: 'Email', value: loginEmail && !isAliasEmail(loginEmail) ? loginEmail : 'Không dùng email' },
                    {
                      label: 'Số điện thoại đăng nhập',
                      value: account.login_phone ? formatPhone(`0${account.login_phone.slice(3)}`) : 'Không bật',
                    },
                    {
                      label: 'Trạng thái',
                      value: !account.is_active ? (
                        <Badge tone="red">Đã khóa</Badge>
                      ) : account.must_change_password ? (
                        <Badge tone="amber">Chờ đổi mật khẩu</Badge>
                      ) : (
                        <Badge tone="green">Hoạt động</Badge>
                      ),
                    },
                    { label: 'Tạo lúc', value: formatDate(account.created_at) },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  {account.is_active ? (
                    <ActionButton
                      action={setAccountActiveAction.bind(null, account.user_id, e.id, false)}
                      label="Khóa tài khoản"
                      variant="danger"
                      confirmMessage="Khóa đăng nhập của nhân viên này?"
                    />
                  ) : (
                    <ActionButton action={setAccountActiveAction.bind(null, account.user_id, e.id, true)} label="Mở khóa tài khoản" />
                  )}
                </div>
                <Disclosure summary="Đặt lại mật khẩu">
                  <ActionForm action={resetPasswordAction.bind(null, account.user_id, e.id)}>
                    <TextField name="password" label="Mật khẩu tạm mới" defaultValue={generateTempPassword()} autoComplete="off" />
                    <SubmitButton size="sm" variant="outline">
                      Đặt mật khẩu tạm
                    </SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            ) : active ? (
              <ActionForm action={createAccountAction.bind(null, e.id)}>
                <TextField name="email" label="Email đăng nhập" type="email" defaultValue={e.email ?? ''} optional autoComplete="off" />
                <TextField
                  name="login_phone"
                  label="Số điện thoại đăng nhập"
                  inputMode="tel"
                  defaultValue={e.phone ?? ''}
                  optional
                  autoComplete="off"
                  hint="Điền ít nhất một trong hai."
                />
                <TextField name="password" label="Mật khẩu tạm" defaultValue={generateTempPassword()} autoComplete="off" />
                <SubmitButton size="sm">Tạo tài khoản</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-muted">Nhân viên đã nghỉ việc.</p>
            )}
          </Panel>

          {account && (
            <Panel
              title="Quyền theo chi nhánh"
              description="Nhân viên chỉ thấy và thao tác dữ liệu của chi nhánh được cấp. Database kiểm tra quyền ở mọi truy vấn."
            >
              <PermissionMatrix
                branches={branches}
                granted={perms}
                actionFor={(branchId) => setPermissionsAction.bind(null, account.user_id, e.id, branchId)}
              />
            </Panel>
          )}

          <Panel
            title="Mức lương"
            description="Mỗi mức có ngày áp dụng; ca làm dùng mức gần nhất trước ngày làm. Không sửa được mức thuộc tháng đã chốt lương."
          >
            {rates.length === 0 ? (
              <p className="mb-4 text-muted">Chưa có mức lương — không chốt được bảng lương cho nhân viên này.</p>
            ) : (
              <ul className="mb-4 divide-y divide-line">
                {rates.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2">
                        <span className="font-display text-lg tabular">
                          {r.pay_type === 'hourly' ? `${formatVnd(r.hourly_rate)}/giờ` : `${formatVnd(r.daily_rate)}/ngày`}
                        </span>
                        {r.id === currentRate?.id && <Badge tone="green">Đang áp dụng</Badge>}
                      </span>
                      <span className="text-sm text-muted">
                        Từ {formatDateKey(r.effective_from)}
                        {r.pay_type === 'daily' ? `, ngày chuẩn ${formatMinutes(r.standard_day_minutes)}` : ''}
                        {r.note ? `, ${r.note}` : ''}
                      </span>
                    </span>
                    <ActionButton
                      action={deletePayRateAction.bind(null, r.id, e.id)}
                      label="Xóa"
                      variant="ghost"
                      confirmMessage="Xóa mức lương này?"
                    />
                  </li>
                ))}
              </ul>
            )}
            <Disclosure summary="Thêm mức lương">
              <ActionForm action={addPayRateAction.bind(null, e.id)} resetOnSuccess>
                <SelectField
                  name="pay_type"
                  label="Cách tính"
                  defaultValue="hourly"
                  options={Object.entries(PAY_TYPE).map(([value, label]) => ({ value, label }))}
                />
                <TextField name="rate" label="Mức (đ)" inputMode="numeric" required hint="Theo giờ hoặc theo ngày công." />
                <TextField
                  name="standard_day_minutes"
                  label="Phút chuẩn một ngày công"
                  type="number"
                  min={60}
                  max={900}
                  defaultValue={480}
                  hint="Chỉ dùng khi tính theo ngày."
                />
                <TextField name="effective_from" label="Áp dụng từ" type="date" defaultValue={todayKey()} required />
                <TextField name="note" label="Ghi chú" optional />
                <SubmitButton size="sm">Thêm mức lương</SubmitButton>
              </ActionForm>
            </Disclosure>
          </Panel>
        </div>

        <Panel title="Hồ sơ">
          <ActionForm action={updateEmployeeAction.bind(null, e.id)}>
            <TextField name="full_name" label="Họ tên" defaultValue={e.full_name} required />
            <TextField name="code" label="Mã nhân viên" defaultValue={e.code} required />
            <SelectField
              name="home_branch_id"
              label="Chi nhánh chính"
              defaultValue={e.home_branch_id}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <SelectField
              name="employment_type"
              label="Hình thức"
              defaultValue={e.employment_type}
              options={Object.entries(EMPLOYMENT_TYPE).map(([value, label]) => ({ value, label }))}
            />
            <TextField name="phone" label="Số điện thoại" defaultValue={e.phone ?? ''} optional inputMode="tel" />
            <TextField name="email" label="Email liên hệ" type="email" defaultValue={e.email ?? ''} optional />
            <TextField name="hired_on" label="Ngày vào làm" type="date" defaultValue={e.hired_on ?? ''} optional />
            <TextareaField name="notes" label="Ghi chú" defaultValue={e.notes ?? ''} optional rows={3} />
            <SubmitButton>Lưu hồ sơ</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
