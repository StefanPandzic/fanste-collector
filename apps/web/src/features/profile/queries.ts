import 'server-only';

import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { Tables } from '@fanste/supabase';

export type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'avatar_url' | 'default_currency'
>;

/** The signed-in user's profile (RLS limits the query to their own row). Cached per request. */
export const getProfile = cache(async (userId: string): Promise<ProfileRow | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, default_currency')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the profile: ${error.message}`);
  return data;
});
