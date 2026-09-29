import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/apply', '/activate', '/api/auth/login', '/api/auth/demo', '/api/auth/activate', '/api/health', '/api/admissions/apply', '/api/admissions/grades', '/api/register', '/offline', '/manifest.webmanifest'];

/**
 * Optimistic auth check: redirects unauthenticated page/API traffic to /login.
 * Full session validation happens server-side in pages and route handlers.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  // allow PWA + static assets
  if (/\.(png|jpg|jpeg|svg|ico|js|css|webmanifest)$/.test(pathname)) return NextResponse.next();

  const token = request.cookies.get('kaizen_session')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
