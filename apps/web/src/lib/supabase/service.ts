// Fails the build if this module is ever imported from a Client Component: it uses the secret key.
import 'server-only';

import { createServiceClient, requireSupabaseEnv } from '@fanste/supabase';

import { clientEnv } from '@/env/client';
import { serverEnv } from '@/env/server';

import type { FansteSupabaseClient } from '@fanste/supabase';

/**
 * Supabase client with the secret key, which **bypasses RLS**. Only for trusted server-side writes,
 * such as the API gateway's metadata cache (FC-08). Never use it to serve a user's own data: use
 * `createSupabaseServerClient()` so RLS applies.
 */
export function createSupabaseServiceClient(): FansteSupabaseClient {
  const env = requireSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: serverEnv.SUPABASE_SECRET_KEY,
  });
  return createServiceClient({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: env.SUPABASE_SECRET_KEY,
  });
}
