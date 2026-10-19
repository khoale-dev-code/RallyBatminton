import { NextResponse, type NextRequest } from 'next/server';

import { finishMemberAuth } from '@/features/member/lib/finish-auth';
import { createClient } from '@/lib/supabase/server';

/** Supabase chuyển về đây kèm ?code= (đăng nhập Google, kích hoạt email, đặt lại mật khẩu — luồng PKCE). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    // Khách bấm "Hủy" ở màn hình Google → Supabase trả về ?error=access_denied.
    const reason = request.nextUrl.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'callback';
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.nextUrl.origin));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=link', request.nextUrl.origin));
  const recovery = request.nextUrl.searchParams.get('next') === '/reset-password';
  return finishMemberAuth(request, supabase, recovery);
}
