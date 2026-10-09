import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { isRecentRecoverySession } from './recovery';
import { SIGN_IN_PATH } from './routes';

import type { User } from '@fanste/supabase';

/**
 * The signed-in user for this request, verified with the Auth server, or `null`. Cached per
 * request, so layouts and pages can all call it.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * The signed-in user; redirects to sign-in when there is none. Call it (or `getCurrentUser()`) in
 * every `(app)` page that loads user data: the layout's check doesn't cover a page's own payload
 * on client-side navigation.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}

/** `true` if this request's session came from a password reset link opened within the last hour. */
export async function hasRecoverySession(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return isRecentRecoverySession(data?.claims ?? null);
}
