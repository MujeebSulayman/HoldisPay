import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain-split proxy
 *
 * holdispay.xyz      → landing page only (app/page.tsx at "/")
 * app.holdispay.xyz  → all app routes (signin, signup, dashboard, etc.)
 *
 * Any request to the root domain for an app route is redirected to
 * app.holdispay.xyz. Any request to the app subdomain for "/" is
 * redirected to /signin.
 */

const ROOT_DOMAIN = 'holdispay.xyz';
const APP_DOMAIN = 'app.holdispay.xyz';

/** Routes that belong exclusively on the app subdomain */
const APP_ROUTES = [
  '/signin',
  '/signup',
  '/dashboard',
  '/invoices',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-email-required',
  '/admin',
];

/** Static file / Next.js internal paths that should always pass through */
function isStaticOrInternal(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    /\.(.+)$/.test(pathname) // any file extension (images, fonts, etc.)
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always pass through static assets and Next.js internals
  if (isStaticOrInternal(pathname)) {
    return NextResponse.next();
  }

  // Detect the current host (strip port for local dev)
  const host = req.headers.get('host') ?? '';
  const hostname = host.split(':')[0];

  // ── Root domain (holdispay.xyz) ──────────────────────────────────────────
  // Only "/" is allowed here. Everything else redirects to the app subdomain.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    const isAppRoute = APP_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );

    if (isAppRoute) {
      const appUrl = new URL(req.url);
      appUrl.hostname = APP_DOMAIN;
      return NextResponse.redirect(appUrl, 308); // permanent redirect
    }

    // "/" and unknown public paths → serve normally
    return NextResponse.next();
  }

  // ── App subdomain (app.holdispay.xyz) ───────────────────────────────────
  // "/" on the app subdomain → send to /signin
  if (hostname === APP_DOMAIN) {
    if (pathname === '/') {
      const signinUrl = new URL(req.url);
      signinUrl.pathname = '/signin';
      return NextResponse.redirect(signinUrl);
    }

    // All other app routes pass through normally
    return NextResponse.next();
  }

  // ── Local development (localhost) ────────────────────────────────────────
  // No domain restrictions; let everything through so dev workflow is smooth.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
