import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Two jobs, in this order:
 *
 *   1. Refresh the Supabase session cookie. Access tokens expire in an hour;
 *      without this the owner gets bounced to the login screen mid-shift.
 *   2. Send anonymous visitors to /admin/login before a page even renders.
 *
 * This is a convenience layer, NOT the security boundary. The real check is
 * requireAdmin() inside the protected layout and every route handler, which
 * also verifies the email against `admin_users`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith('/admin/login');

  if (!user && pathname.startsWith('/admin') && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the favicon and the realtime stream
     * (an open SSE connection must not be re-authenticated on every chunk).
     */
    '/((?!_next/static|_next/image|favicon.ico|api/realtime|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
