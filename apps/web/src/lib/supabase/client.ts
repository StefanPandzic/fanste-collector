import { createBrowserClient } from '@fanste/supabase';

import { supabasePublicConfig } from './config';

import type { FansteSupabaseClient } from '@fanste/supabase';

/**
 * Supabase client for Client Components, acting as the signed-in user (RLS applies). The session
 * lives in cookies shared with the server client. `@supabase/ssr` returns the same instance on every
 * call in the browser, so call this wherever a client is needed.
 */
export function createSupabaseBrowserClient(): FansteSupabaseClient {
  return createBrowserClient(supabasePublicConfig());
}
