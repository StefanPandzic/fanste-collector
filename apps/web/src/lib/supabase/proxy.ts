import { NextResponse } from 'next/server';

import { createServerClient } from '@fanste/supabase';

import { supabasePublicConfig } from './config';

import type { JwtPayload } from '@fanste/supabase';
import type { NextRequest } from 'next/server';

export interface SessionUpdate {
  /** Response that carries the refreshed auth cookies; copy them onto any redirect you return. */
  response: NextResponse;
  /** Verified JWT claims of the signed-in user, or `null` when signed out. */
  claims: JwtPayload | null;
}

/**
 * Refreshes the Supabase session for a request in `proxy.ts`. Server Components can't write
 * cookies, so this is where an expired access token is renewed and the new cookies are set, both on
 * the request (for the page being rendered) and on the response (for the browser).
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabasePublicConfig(), {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      // `Cache-Control: no-store` etc., so no CDN caches a response carrying someone's session.
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    },
  });

  // Verifies the JWT (and refreshes it when expired). Nothing may run between creating the client
  // and this call, or users can be signed out at random.
  const { data } = await supabase.auth.getClaims();
  return { response, claims: data?.claims ?? null };
}

/** A redirect that keeps the cookies `updateSession()` set, so a refreshed session isn't lost. */
export function redirectWithSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}
