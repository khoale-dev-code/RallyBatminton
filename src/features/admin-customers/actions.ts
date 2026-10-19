'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { generateTempPassword, setAuthBan } from '@/features/admin-staff/accounts';
import { requireOwner } from '@/lib/auth/guards';
import { formDbError, formError, formSuccess, formZodError, type FormState } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';
import { createSecretClient } from '@/lib/supabase/secret';
import { formDataToObject, zCheckbox, zInt, zOptionalText, zOptionalVnPhone, zText } from '@/lib/validation';

const schema = z.object({
  full_name: zText('họ tên', 2, 80),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.email('Email không hợp lệ').optional()),
  staff_note: zOptionalText(500),
  marketing_opt_in: zCheckbox(),
});

export async function updateCustomerAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = schema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({
      full_name: parsed.data.full_name,
      email: parsed.data.email ?? null,
      staff_note: parsed.data.staff_note ?? null,
      marketing_opt_in: parsed.data.marketing_opt_in,
    })
    .eq('id', id);
  if (error) return formDbError(error);
  revalidatePath(`/admin/customers/${id}`);
  return formSuccess('Đã lưu thông tin khách.');
}

// ---------------------------------------------------------------------------
// Thành viên — chỉ chủ sân được sửa (database kiểm tra lại bằng private.require_owner)
// ---------------------------------------------------------------------------
function memberPath(userId: string) {
  return `/admin/customers/members/${userId}`;
}

const memberSchema = z.object({
  full_name: zText('họ tên', 2, 80),
  phone: zOptionalVnPhone(),
  staff_note: zOptionalText(500),
});

export async function updateMemberAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = memberSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_member', {
    p_user_id: userId,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone ?? null,
    p_staff_note: parsed.data.staff_note ?? null,
  });
  if (error) return formDbError(error);
  revalidatePath(memberPath(userId));
  revalidatePath('/admin/customers');
  return formSuccess('Đã lưu thông tin thành viên.');
}

const pointsSchema = z.object({
  direction: z.enum(['add', 'subtract']),
  amount: zInt('Số điểm', 1, 100000),
  reason: zText('lý do', 3, 200),
});

export async function adjustMemberPointsAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = pointsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return formZodError(parsed.error);
  const delta = parsed.data.direction === 'add' ? parsed.data.amount : -parsed.data.amount;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_adjust_member_points', { p_user_id: userId, p_delta: delta, p_reason: parsed.data.reason });
  if (error) return formDbError(error);
  revalidatePath(memberPath(userId));
  return formSuccess(delta > 0 ? `Đã cộng ${delta} điểm.` : `Đã trừ ${-delta} điểm.`);
}

export async function setMemberLockedAction(userId: string, locked: boolean, _prev: FormState): Promise<FormState> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_member_locked', { p_user_id: userId, p_locked: locked });
  if (error) return formDbError(error);
  // Khóa cả ở tầng Auth để phiên đang mở không làm mới được.
  let banError: string | null = null;
  try {
    banError = await setAuthBan(createSecretClient(), userId, locked);
  } catch {
    banError = 'no_secret';
  }
  revalidatePath(memberPath(userId));
  revalidatePath('/admin/customers');
  if (banError)
    return formSuccess(locked ? 'Đã khóa thành viên (chưa chặn được phiên đăng nhập: thiếu SUPABASE_SECRET_KEY).' : 'Đã mở khóa.');
  return formSuccess(locked ? 'Đã khóa tài khoản thành viên.' : 'Đã mở khóa tài khoản thành viên.');
}

export interface TempPasswordState extends FormState {
  tempPassword?: string;
}

/** Cấp mật khẩu tạm (khách quên mật khẩu tài khoản SĐT). Khách phải đổi ở lần đăng nhập tới. */
export async function resetMemberPasswordAction(userId: string, _prev: TempPasswordState): Promise<TempPasswordState> {
  await requireOwner();
  const supabase = await createClient();
  // Chỉ áp dụng cho tài khoản thành viên — không dùng đường này cho tài khoản nhân sự.
  const { data: member, error: memberError } = await supabase.rpc('admin_get_member', { p_user_id: userId });
  if (memberError || member === null) return formError('Không tìm thấy thành viên.');
  let secret;
  try {
    secret = createSecretClient();
  } catch {
    return formError('Máy chủ chưa cấu hình SUPABASE_SECRET_KEY nên chưa cấp được mật khẩu tạm.');
  }
  const tempPassword = generateTempPassword();
  const { error } = await secret.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) return formError('Không đặt được mật khẩu tạm. Vui lòng thử lại.');
  await secret.rpc('service_set_member_password_flag', { p_user_id: userId, p_must_change: true });
  revalidatePath(memberPath(userId));
  return { ...formSuccess('Đã cấp mật khẩu tạm. Đọc cho khách — khách sẽ phải đổi mật khẩu khi đăng nhập.'), tempPassword };
}
