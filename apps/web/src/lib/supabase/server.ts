import 'server-only';

import { cookies } from 'next/headers';

import { createServerClient } from '@fanste/supabase';

import { supabasePublicConfig } from './config';

import type { FansteSupabaseClient } from '@fanste/supabase';

/**
 * Supabase client for Server Components, Route Handlers and Server Functions, acting as the
 * signed-in user from the request cookies (RLS applies). Create one per request; never cache it.
 */
export async function createSupabaseServerClient(): Promise<FansteSupabaseClient> {
  const config = supabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(config, {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Components can't set cookies. The proxy that refreshes the session (FC-06)
        // writes them instead, so ignoring this here is safe.
      }
    },
  });
}
