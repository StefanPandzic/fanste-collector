import { NextResponse } from 'next/server';

import type { CallbackErrorCode } from '@/features/auth/errors';
import { safeNextPath, SIGN_IN_PATH } from '@/features/auth/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { NextRequest } from 'next/server';

/**
 * OAuth (PKCE) callback: exchanges the `code` from the provider for a session, using the code
 * verifier cookie that the browser client set when sign-in started. The desktop app loads this route
 * in its window after receiving `fanste://auth/callback?code=…`, so it works there too.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    // The provider sends `error=access_denied` when the user cancels the consent screen.
    const cancelled = searchParams.get('error') === 'access_denied';
    return redirectToSignIn(request, cancelled ? 'oauth_cancelled' : 'oauth_failed');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth] OAuth code exchange failed', error.code);
    return redirectToSignIn(request, 'oauth_failed');
  }

  return NextResponse.redirect(new URL(safeNextPath(searchParams.get('next')), request.url));
}

function redirectToSignIn(request: NextRequest, error: CallbackErrorCode) {
  const url = new URL(SIGN_IN_PATH, request.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
