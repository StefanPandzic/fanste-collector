/** Connection settings for the browser and server clients (publishable key, RLS applies). */
export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

/** Connection settings for the service client (secret key, bypasses RLS). Server-only. */
export interface SupabaseServiceConfig {
  url: string;
  secretKey: string;
}

/**
 * Returns `values` with every entry narrowed to a string, or throws one error that names each
 * missing variable. Keys are the env var names, so the message tells the developer what to set.
 *
 * @example
 * const { NEXT_PUBLIC_SUPABASE_URL: url } = requireSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: env.url });
 */
export function requireSupabaseEnv<K extends string>(
  values: Record<K, string | undefined>,
): Record<K, string> {
  const missing = Object.entries<string | undefined>(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Supabase is not configured. Set ${missing.join(', ')} in the repo-root .env.local ` +
        '(see .env.example and README → Supabase).',
    );
  }
  return values as Record<K, string>;
}
