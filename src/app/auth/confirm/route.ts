import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { finishMemberAuth } from '@/features/member/lib/finish-auth';
import { createClient } from '@/lib/supabase/server';

const TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Liên kết trong email dạng {{ .SiteURL }}/auth/confirm?token_hash=…&type=… (mở được trên thiết bị khác
 * với thiết bị đã đăng ký — khác luồng ?code=). Xem README mục "Email của Supabase".
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = TYPES.find((t) => t === params.get('type'));
  if (!tokenHash || !type) return NextResponse.redirect(new URL('/login?error=link', request.nextUrl.origin));
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL('/login?error=link', request.nextUrl.origin));
  return finishMemberAuth(request, supabase, type === 'recovery');
}
