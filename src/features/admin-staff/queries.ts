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

export async function getStaffMember(employeeId: string) {
  const supabase = await createClient();
  const { data: employee } = await supabase
    .from('employees')
    .select('*, branches(name), staff_accounts(user_id, role, display_name, login_phone, is_active, must_change_password, created_at)')
    .eq('id', employeeId)
    .maybeSingle();
  if (!employee) return null;
  const account = employee.staff_accounts;
  const [{ data: rates }, { data: perms }, { data: branches }] = await Promise.all([
    supabase.from('employee_pay_rates').select('*').eq('employee_id', employeeId).order('effective_from', { ascending: false }),
    account
      ? supabase.from('staff_branch_permissions').select('branch_id, permission').eq('user_id', account.user_id)
      : Promise.resolve({ data: [] }),
    supabase.from('branches').select('id, name, status').is('deleted_at', null).order('name'),
  ]);

  // Email đăng nhập nằm trong Supabase Auth (không lưu lặp ở bảng public) — đọc bằng quyền server.
  let loginEmail: string | null = null;
  if (account) {
    try {
      const { data } = await createSecretClient().auth.admin.getUserById(account.user_id);
      loginEmail = data.user?.email ?? null;
    } catch {
      loginEmail = null;
    }
  }
  return { employee, account, loginEmail, rates: rates ?? [], perms: perms ?? [], branches: branches ?? [] };
}

export async function listBranchesForSelect() {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('id, name').is('deleted_at', null).order('name');
  return data ?? [];
}
