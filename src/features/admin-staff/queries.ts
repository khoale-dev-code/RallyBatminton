import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';

export async function listStaff() {
  const supabase = await createClient();
  const [{ data: employees, error }, { data: owners }] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, code, full_name, phone, status, employment_type, branches(name), staff_accounts(user_id, is_active, login_phone, must_change_password)',
      )
      .order('status')
      .order('full_name'),
    supabase.from('staff_accounts').select('user_id, display_name, is_active').eq('role', 'owner').order('display_name'),
  ]);
  if (error) throw error;
  return { employees: employees ?? [], owners: owners ?? [] };
}

export async function suggestEmployeeCode(): Promise<string> {
  const supabase = await createClient();
  const { count } = await supabase.from('employees').select('id', { count: 'exact', head: true });
  return `NV${String((count ?? 0) + 1).padStart(3, '0')}`;
}

/** Email đăng nhập nằm trong Supabase Auth (không lưu lặp ở bảng public) — đọc bằng quyền server. */
async function loginEmailOf(userId: string): Promise<string | null> {
  try {
    const { data } = await createSecretClient().auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function getStaffMember(employeeId: string) {
  const supabase = await createClient();
  // Lượt 1: hồ sơ + bậc lương + chi nhánh (chỉ cần id nhân viên). Lượt 2: quyền + email (cần user_id).
  const [{ data: employee }, { data: rates }, { data: branches }] = await Promise.all([
    supabase
      .from('employees')
      .select('*, branches(name), staff_accounts(user_id, role, display_name, login_phone, is_active, must_change_password, created_at)')
      .eq('id', employeeId)
      .maybeSingle(),
    supabase.from('employee_pay_rates').select('*').eq('employee_id', employeeId).order('effective_from', { ascending: false }),
    supabase.from('branches').select('id, name, status').is('deleted_at', null).order('name'),
  ]);
  if (!employee) return null;
  const account = employee.staff_accounts;
  const [{ data: perms }, loginEmail] = await Promise.all([
    account
      ? supabase.from('staff_branch_permissions').select('branch_id, permission').eq('user_id', account.user_id)
      : Promise.resolve({ data: [] }),
    account ? loginEmailOf(account.user_id) : Promise.resolve(null),
  ]);
  return { employee, account, loginEmail, rates: rates ?? [], perms: perms ?? [], branches: branches ?? [] };
}

export async function listBranchesForSelect() {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('id, name').is('deleted_at', null).order('name');
  return data ?? [];
}
