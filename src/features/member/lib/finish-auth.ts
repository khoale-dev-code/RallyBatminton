import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { CONSENT_TEXT } from '@/features/privacy/consent-text';
import { recordAccountConsents } from '@/features/privacy/record-consent';
import { errorCode } from '@/lib/errors';
import { type AppSupabaseClient } from '@/lib/supabase/server';

import { safeMemberNext } from '../schemas';

/**
 * Sau khi Supabase xác nhận (email kích hoạt, Google, đặt lại mật khẩu): đảm bảo đây là tài khoản
 * KHÁCH rồi chuyển tiếp. Tài khoản nhân sự / bị khóa bị đăng xuất và về trang đăng nhập khách.
 */
export async function finishMemberAuth(request: NextRequest, supabase: AppSupabaseClient, recovery: boolean): Promise<NextResponse> {
  const url = request.nextUrl;
  const next = recovery ? '/reset-password' : safeMemberNext(url.searchParams.get('next'));
  const { data, error } = await supabase.rpc('ensure_member_profile');
  if (error) {
    await supabase.auth.signOut();
    const code = errorCode(error);
    const reason = code === 'STAFF_ACCOUNT' ? 'staff' : code === 'MEMBER_LOCKED' ? 'locked' : 'callback';
    return NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));
  }
  if (!recovery) {
    // Tài khoản mới tạo bằng Google: lưu bằng chứng "tiếp tục với Google = đồng ý điều khoản" (chỉ ghi lần đầu).
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await recordAccountConsents(auth.user.id, false, CONSENT_TEXT.accountTermsGoogle);
  }
  const mustChange = !recovery && typeof data === 'object' && data !== null && !Array.isArray(data) && data.must_change_password === true;
  return NextResponse.redirect(new URL(mustChange ? '/account/profile?doi-mat-khau=1' : next, url.origin));
}
