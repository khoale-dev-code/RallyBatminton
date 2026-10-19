import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isSupabaseConfigured, publicEnv } from '@/lib/env';

/**
 * Proxy (Next.js 16, thay cho middleware):
 *  1. Làm mới phiên Supabase (cookie) trước khi Server Component đọc.
 *  2. Kiểm tra lạc quan: chưa đăng nhập thì chuyển về trang đăng nhập phù hợp —
 *     khu quản trị → /admin-login (nội bộ), tài khoản khách → /login.
 * Quyền thật sự vẫn do RLS + RPC quyết định ở database.
 */
const STAFF_PREFIXES = ['/admin', '/checkin'];
const MEMBER_PREFIXES = ['/account'];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getSession chỉ đọc cookie (gọi mạng khi cần làm mới token hết hạn) — nhanh hơn getClaims/getUser.
  // Đây chỉ là kiểm tra lạc quan để chuyển hướng; quyền thật do database xác minh JWT ở từng truy vấn.
  const { data } = await supabase.auth.getSession();
  const isSignedIn = data.session !== null;
  const { pathname, search } = request.nextUrl;

  const loginPath = matches(pathname, STAFF_PREFIXES) ? '/admin-login' : matches(pathname, MEMBER_PREFIXES) ? '/login' : null;
  if (!isSignedIn && loginPath) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/webhooks|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|avif|woff2?)$).*)'],
};
