// Not `./schema`: that module also holds the server schema, whose keys name the secrets.
import { clientEnvSchema, parseEnv } from './client-schema';

/**
 * Browser-safe env vars. Each `NEXT_PUBLIC_*` var must be read with a literal `process.env.NAME`
 * expression, because Next.js inlines them at build time and can't see dynamic lookups.
 */
export const clientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  'client',
);
