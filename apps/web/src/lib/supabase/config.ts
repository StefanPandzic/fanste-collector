import { requireSupabaseEnv } from '@fanste/supabase';

import { clientEnv } from '@/env/client';

import type { SupabasePublicConfig } from '@fanste/supabase';

/** URL and publishable key for the browser and server clients; throws if they aren't set. */
export function supabasePublicConfig(): SupabasePublicConfig {
  const env = requireSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
