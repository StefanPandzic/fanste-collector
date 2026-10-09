import { NextResponse } from 'next/server';

import { isEmailLinkType } from '@/features/auth/email-link';
import type { CallbackErrorCode } from '@/features/auth/errors';
import { safeNextPath, SIGN_IN_PATH } from '@/features/auth/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { NextRequest } from 'next/server';

/**
 * Target of the links in auth emails (sign-up confirmation, password reset, email change), built by
 * the templates in `supabase/templates/` as `/auth/confirm?token_hash=…&type=…&next=…`. Verifying
 * the token hash signs the user in on whichever device opened the link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (tokenHash && isEmailLinkType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(safeNextPath(searchParams.get('next')), request.url));
    }
    console.error('[auth] Email link verification failed', error.code);
  }

  const url = new URL(SIGN_IN_PATH, request.url);
  url.searchParams.set('error', 'link_invalid' satisfies CallbackErrorCode);
  return NextResponse.redirect(url);
}
