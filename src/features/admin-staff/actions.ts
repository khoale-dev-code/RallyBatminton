'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { clearStaffContextCache } from '@/lib/auth/context-cache';
import { setFlash } from '@/lib/flash';
import { requireOwner } from '@/lib/auth/guards';
import { ALL_PERMISSIONS, type AppPermission } from '@/lib/auth/permissions';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { toE164 } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { todayKey } from '@/lib/time';
import {
  formDataStrings,
  formDataToObject,
  zCheckbox,
  zDateKey,
  zInt,
  zMoney,
  zOptionalText,
  zOptionalVnPhone,
  zText,
  zUuid,
} from '@/lib/validation';

import { ACCOUNT_ERRORS, aliasEmailForPhone, setAuthBan, type AccountErrorCode } from './accounts';

const zOptionalEmail = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email('Email không hợp lệ').optional(),
  );
const zOptionalDate = () => z.preprocess((v) => (v === '' ? undefined : v), zDateKey().optional());
const zPassword = () => z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự');

function revalidateStaff(employeeId?: string) {
  clearStaffContextCache(); // tên / trạng thái / quyền nhân viên đổi → đọc lại quyền ở lần mở trang tới
  revalidatePath('/admin/staff');
  if (employeeId) revalidatePath(`/admin/staff/${employeeId}`);
}

// ---------------------------------------------------------------------------
// Tài khoản đăng nhập (Supabase Auth Admin — chỉ chạy trên máy chủ)
// ---------------------------------------------------------------------------
interface AccountInput {
  employeeId: string;
  displayName: string;
  email?: string;
  phone?: string;
  password: string;
}

async function createLoginAccount(input: AccountInput): Promise<AccountErrorCode | null> {
  if (!input.email && !input.phone) return 'no_login';
  let secret;
  try {
    secret = createSecretClient();
  } catch {
    return 'no_secret';
  }
  const email = input.email ?? aliasEmailForPhone(input.phone ?? '');
  const { data: created, error: authError } = await secret.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (authError || !created.user) {
    return /already|exists|registered/i.test(authError?.message ?? '') ? 'exists' : 'auth_failed';
  }
  const ownerClient = await createClient();
  const { data: me } = await ownerClient.auth.getClaims();
  const { error } = await ownerClient.from('staff_accounts').insert({
    user_id: created.user.id,
    role: 'staff',
    employee_id: input.employeeId,
    display_name: input.displayName,
    login_phone: input.phone ? toE164(input.phone) : null,
    must_change_password: true,
    created_by: typeof me?.claims.sub === 'string' ? me.claims.sub : null,
  });
  if (error) {
    // Hoàn tác: không để lại user Auth mồ côi khi ghi hồ sơ thất bại.
    await secret.auth.admin.deleteUser(created.user.id);
    return /login_phone/.test(error.message) ? 'exists' : 'save_failed';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hồ sơ nhân viên
// ---------------------------------------------------------------------------
const employeeSchema = z.object({
  code: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.string().regex(/^[A-Z0-9_-]{2,24}$/, 'Mã gồm 2–24 chữ in hoa, số, gạch'),
  ),
  full_name: zText('họ tên', 2, 120),
  phone: zOptionalVnPhone(),
  email: zOptionalEmail(),
  home_branch_id: zUuid('chi nhánh chính'),
  employment_type: z.enum(['full_time', 'part_time']),
  hired_on: zOptionalDate(),
  notes: zOptionalText(1000),
});

export async function createEmployeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const raw = formDataToObject(formData);
  const parsed = employeeSchema
    .extend({ create_account: zCheckbox(), password: z.string().optional(), login_by_phone: zCheckbox() })
    .safeParse(raw);
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  if (v.create_account) {
    const pw = zPassword().safeParse(v.password ?? '');
    if (!pw.success) return formError('Kiểm tra mật khẩu tạm.', { password: pw.error.issues[0]?.message });
    if (!v.email && !(v.login_by_phone && v.phone)) {
      return formError('Tài khoản cần email, hoặc bật đăng nhập bằng số điện thoại.', { email: 'Nhập email hoặc dùng số điện thoại' });
    }
  }

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from('employees')
    .insert({
      code: v.code,
      full_name: v.full_name,
      phone: v.phone ?? null,
      email: v.email ?? null,
      home_branch_id: v.home_branch_id,
      employment_type: v.employment_type,
      hired_on: v.hired_on ?? null,
      notes: v.notes ?? null,
    })
    .select('id')
    .single();
  if (error) return formDbError(error);

  if (v.create_account) {
    const problem = await createLoginAccount({
      employeeId: employee.id,
      displayName: v.full_name,
      email: v.email,
      phone: v.login_by_phone ? v.phone : undefined,
      password: v.password ?? '',
    });
    if (problem) {
      revalidateStaff();
      await setFlash('Đã lưu nhân viên nhưng chưa tạo được tài khoản đăng nhập.', 'error');
      redirect(`/admin/staff/${employee.id}?account_error=${problem}`);
    }
  }
  revalidateStaff();
  await setFlash('Đã thêm nhân viên.');
  redirect(`/admin/staff/${employee.id}`);
}

export async function updateEmployeeAction(employeeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = employeeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('employees')
    .update({
      code: v.code,
      full_name: v.full_name,
      phone: v.phone ?? null,
      email: v.email ?? null,
      home_branch_id: v.home_branch_id,
      employment_type: v.employment_type,
      hired_on: v.hired_on ?? null,
      notes: v.notes ?? null,
    })
    .eq('id', employeeId);
  if (error) return formDbError(error);
  revalidateStaff(employeeId);
  return formSuccess('Đã lưu hồ sơ.');
}

/** Cho nghỉ việc: giữ hồ sơ + lịch sử công/lương, khóa đăng nhập. */
export async function setEmployeeStatusAction(employeeId: string, active: boolean, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const today = todayKey();
  const { error } = await supabase
    .from('employees')
    .update(active ? { status: 'active', terminated_on: null } : { status: 'inactive', terminated_on: today })
    .eq('id', employeeId);
  if (error) return formDbError(error);
  const { data: account } = await supabase.from('staff_accounts').select('user_id').eq('employee_id', employeeId).maybeSingle();
  if (account && !active) {
    const { error: accErr } = await supabase.from('staff_accounts').update({ is_active: false }).eq('user_id', account.user_id);
    if (accErr) return formDbError(accErr);
    try {
      await setAuthBan(createSecretClient(), account.user_id, true);
    } catch {
      // Thiếu secret key: cờ is_active=false vẫn chặn mọi quyền qua RLS.
    }
  }
  revalidateStaff(employeeId);
  return formSuccess(
    active ? 'Đã kích hoạt lại hồ sơ. Mở lại tài khoản ở mục Tài khoản nếu cần.' : 'Đã chuyển sang nghỉ việc và khóa đăng nhập.',
  );
}

// ---------------------------------------------------------------------------
// Mức lương
// ---------------------------------------------------------------------------
const payRateSchema = z
  .object({
    pay_type: z.enum(['hourly', 'daily']),
    rate: zMoney('Mức lương', { min: 0, max: 100_000_000 }),
    standard_day_minutes: zInt('Số phút chuẩn mỗi ngày', 60, 900),
    effective_from: zDateKey('ngày áp dụng'),
    note: zOptionalText(200),
  })
  .refine((v) => v.pay_type !== 'hourly' || v.rate <= 20_000_000, { path: ['rate'], message: 'Lương giờ tối đa 20.000.000đ' });

export async function addPayRateAction(employeeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = payRateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('employee_pay_rates').insert({
    employee_id: employeeId,
    pay_type: v.pay_type,
    hourly_rate: v.pay_type === 'hourly' ? v.rate : null,
    daily_rate: v.pay_type === 'daily' ? v.rate : null,
    standard_day_minutes: v.standard_day_minutes,
    effective_from: v.effective_from,
    note: v.note ?? null,
  });
  if (error) return formDbError(error);
  revalidateStaff(employeeId);
  return formSuccess('Đã thêm mức lương.');
}

export async function deletePayRateAction(rateId: string, employeeId: string, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from('employee_pay_rates').delete().eq('id', rateId).eq('employee_id', employeeId);
  if (error) return formDbError(error);
  revalidateStaff(employeeId);
  return formSuccess('Đã xóa mức lương.');
}

// ---------------------------------------------------------------------------
// Tài khoản
// ---------------------------------------------------------------------------
const accountSchema = z.object({
  email: zOptionalEmail(),
  login_phone: zOptionalVnPhone(),
  password: zPassword(),
});

export async function createAccountAction(employeeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = accountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data: employee } = await supabase.from('employees').select('full_name, status').eq('id', employeeId).maybeSingle();
  if (!employee) return formError('Không tìm thấy nhân viên.');
  if (employee.status !== 'active') return formError('Nhân viên đã nghỉ việc.');
  const problem = await createLoginAccount({
    employeeId,
    displayName: employee.full_name,
    email: parsed.data.email,
    phone: parsed.data.login_phone,
    password: parsed.data.password,
  });
  if (problem) return formError(ACCOUNT_ERRORS[problem]);
  revalidateStaff(employeeId);
  return formSuccess('Đã tạo tài khoản. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu.');
}

export async function resetPasswordAction(userId: string, employeeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z.object({ password: zPassword() }).safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { data: account } = await supabase
    .from('staff_accounts')
    .select('role')
    .eq('user_id', userId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!account) return formError('Không tìm thấy tài khoản.');
  try {
    const { error } = await createSecretClient().auth.admin.updateUserById(userId, { password: parsed.data.password });
    if (error) return formError('Không đặt lại được mật khẩu.');
  } catch {
    return formError('Máy chủ chưa cấu hình SUPABASE_SECRET_KEY.');
  }
  const { error } = await supabase.from('staff_accounts').update({ must_change_password: true }).eq('user_id', userId);
  if (error) return formDbError(error);
  revalidateStaff(employeeId);
  return formSuccess('Đã đặt mật khẩu tạm. Nhân viên sẽ phải đổi khi đăng nhập.');
}

export async function setAccountActiveAction(userId: string, employeeId: string, active: boolean, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  if (active) {
    const { data: employee } = await supabase.from('employees').select('status').eq('id', employeeId).maybeSingle();
    if (employee?.status !== 'active') return formError('Kích hoạt lại hồ sơ nhân viên trước.');
  }
  const { error } = await supabase.from('staff_accounts').update({ is_active: active }).eq('user_id', userId).eq('employee_id', employeeId);
  if (error) return formDbError(error);
  try {
    await setAuthBan(createSecretClient(), userId, !active);
  } catch {
    // Không có secret key: is_active vẫn chặn quyền qua RLS.
  }
  revalidateStaff(employeeId);
  return formSuccess(active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
}

const permissionSet = new Set<string>(ALL_PERMISSIONS);

export async function setPermissionsAction(
  userId: string,
  employeeId: string,
  branchId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const permissions = formDataStrings(formData, 'permissions').filter((p): p is AppPermission => permissionSet.has(p));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_staff_permissions', {
    p_user_id: userId,
    p_branch_id: branchId,
    p_permissions: permissions,
  });
  if (error) return formDbError(error);
  revalidateStaff(employeeId);
  const added = (data ?? []).length - permissions.length;
  return formSuccess(added > 0 ? `Đã lưu quyền (tự thêm ${added} quyền xem bắt buộc).` : 'Đã lưu quyền.');
}
