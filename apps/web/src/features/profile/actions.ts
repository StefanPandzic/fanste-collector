'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { profileSchema } from '@fanste/core';

import { formFields, invalidFields } from '@/features/auth/form-state';
import type { FormState } from '@/features/auth/form-state';
import { SIGN_IN_PATH } from '@/features/auth/routes';
import { getCurrentUser } from '@/features/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

import { AVATAR_BUCKET, isOwnAvatarPath } from './avatar-path';

import type { FansteSupabaseClient, User } from '@fanste/supabase';

const SAVE_FAILED = 'Could not save your changes. Please try again.';

/** The verified user; Server Actions can be called directly, so each one checks again. */
async function currentUserOrSignIn(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUserOrSignIn();
  const fields = formFields(formData, ['displayName', 'defaultCurrency']);
  const parsed = profileSchema.safeParse(fields);
  if (!parsed.success) return invalidFields(parsed.error, fields);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      default_currency: parsed.data.defaultCurrency,
    })
    .eq('id', user.id);
  if (error) {
    console.error('[profile] Update failed', error.code);
    return { error: SAVE_FAILED, values: fields };
  }

  revalidatePath('/', 'layout');
  return { success: 'Profile saved.', values: fields };
}

/**
 * Points the profile at an avatar the browser just uploaded to `avatars/<user id>/…` (Storage RLS
 * only allows uploads into the user's own folder) and deletes the user's older avatar files.
 */
export async function saveAvatar(path: string): Promise<FormState> {
  const user = await currentUserOrSignIn();
  if (typeof path !== 'string' || !isOwnAvatarPath(path, user.id)) {
    return { error: 'That upload is not yours.' };
  }

  const supabase = await createSupabaseServerClient();
  const { publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data;
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);
  if (error) {
    console.error('[profile] Saving the avatar failed', error.code);
    return { error: SAVE_FAILED };
  }

  await removeAvatarFiles(supabase, user.id, path);
  revalidatePath('/', 'layout');
  return { success: 'Avatar updated.' };
}

export async function removeAvatar(): Promise<FormState> {
  const user = await currentUserOrSignIn();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
  if (error) {
    console.error('[profile] Removing the avatar failed', error.code);
    return { error: SAVE_FAILED };
  }

  await removeAvatarFiles(supabase, user.id);
  revalidatePath('/', 'layout');
  return { success: 'Avatar removed.' };
}

/**
 * Deletes the signed-in user's account. Their profile, collection, tags and scanner data go with it
 * (`on delete cascade`); avatar files are deleted first, since Storage objects can't cascade.
 */
export async function deleteAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUserOrSignIn();
  if (formFields(formData, ['confirm']).confirm !== 'DELETE') {
    return { fieldErrors: { confirm: ['Type DELETE to confirm.'] } };
  }

  try {
    // The admin API needs the secret key. The user ID comes from the verified session, never from
    // the form, so a user can only delete themselves.
    const admin = createSupabaseServiceClient();
    await removeAvatarFiles(admin, user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (error) {
    console.error('[profile] Deleting the account failed', error);
    return { error: 'Could not delete your account. Please try again later.' };
  }

  // The session is no longer valid; clear its cookies in this browser.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(SIGN_IN_PATH);
}

/** Deletes the user's avatar files, except `keepPath`. Failures are logged, not fatal. */
async function removeAvatarFiles(
  supabase: FansteSupabaseClient,
  userId: string,
  keepPath?: string,
): Promise<void> {
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { data: files, error } = await bucket.list(userId, { limit: 100 });
  if (error) {
    console.error('[profile] Listing avatar files failed', error.message);
    return;
  }
  const paths = files.map((file) => `${userId}/${file.name}`).filter((path) => path !== keepPath);
  if (paths.length === 0) return;

  const { error: removeError } = await bucket.remove(paths);
  if (removeError) console.error('[profile] Deleting old avatar files failed', removeError.message);
}
