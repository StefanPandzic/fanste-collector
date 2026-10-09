import { DEFAULT_SIGNED_IN_PATH, routeAccess, signInPathFor } from '@/features/auth/routes';
import { redirectWithSession, updateSession } from '@/lib/supabase/proxy';

import type { NextRequest } from 'next/server';

/**
 * Runs before every page and route handler: refreshes the Supabase session cookies and keeps
 * signed-out users out of the app. Pages still check the user themselves (`requireUser()`), since
 * the proxy is only the first line of defense.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const access = routeAccess(pathname);

  if (access === 'protected' && !claims) {
    return redirectWithSession(
      new URL(signInPathFor(`${pathname}${search}`), request.url),
      response,
    );
  }
  if (access === 'guest-only' && claims) {
    return redirectWithSession(new URL(DEFAULT_SIGNED_IN_PATH, request.url), response);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, image optimization and metadata files.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
