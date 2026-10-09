'use server';

import { redirect } from 'next/navigation';

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@fanste/core';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { authErrorMessage } from './errors';
import { formFields, invalidFields } from './form-state';
import { DEFAULT_SIGNED_IN_PATH, safeNextPath, SIGN_IN_PATH } from './routes';
import { hasRecoverySession } from './session';

import type { FormState } from './form-state';

/*
 * Email/password auth. These run on the server, so the session cookies are set by the response.
 * Email links (confirmation, password reset) point at `/auth/confirm` through the email templates in
 * `supabase/templates/`, not at a `redirectTo`, so they work on any device (no PKCE verifier needed).
 */

export async function signIn(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData, ['email', 'password', 'next']);
  const values = { email: fields.email };
  const parsed = signInSchema.safeParse(fields);
  if (!parsed.success) return invalidFields(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNextPath(fields.next));
}

export async function signUp(_state: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData, ['email', 'password']);
  const values = { email: fields.email };
  const parsed = signUpSchema.safeParse(fields);
  if (!parsed.success) return invalidFields(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    console.error('[auth] Sign-up failed', error.code);
    return { error: authErrorMessage(error), values };
  }
  // With email confirmation off (not our setup, but possible in a fresh project) there is a session.
  if (data.session) redirect(DEFAULT_SIGNED_IN_PATH);

  // Same message whether or not the address was already registered, so it can't be probed.
  return {
    success: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`,
  };
}

export async function requestPasswordReset(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = formFields(formData, ['email']);
  const parsed = forgotPasswordSchema.safeParse(fields);
  if (!parsed.success) return invalidFields(parsed.error, fields);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  // Rate limits are worth telling; anything else would reveal whether the account exists.
  if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') {
    return { error: authErrorMessage(error), values: fields };
  }
  if (error) console.error('[auth] Password reset request failed', error.code);

  return {
    success: `If ${parsed.data.email} has an account, we sent it a link to reset the password.`,
  };
}

/**
 * Sets a new password, only for a session started by a password reset link (see
 * `isRecentRecoverySession()`), so a signed-in window alone can't be used to change it.
 */
export async function updatePassword(_state: FormState, formData: FormData): Promise<FormState> {
  if (!(await hasRecoverySession())) {
    return { error: 'This reset link has expired. Request a new one from the sign-in page.' };
  }
  const parsed = resetPasswordSchema.safeParse(
    formFields(formData, ['password', 'confirmPassword']),
  );
  if (!parsed.success) return invalidFields(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };

  redirect(DEFAULT_SIGNED_IN_PATH);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // Only this browser or app: signing out on the web must not sign the desktop app out too.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) console.error('[auth] Sign-out failed', error.code);
  redirect(SIGN_IN_PATH);
}
