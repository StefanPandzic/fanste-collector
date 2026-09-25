import { z } from 'zod';

import { optionalString } from './client-schema';

/**
 * Env var schemas, shared by `./server` and `next.config.ts`, which validates them once at startup
 * so a bad value fails fast instead of on first use. The browser-safe part lives in
 * `./client-schema`; never import this module from `./client` or other client code.
 */

export { clientEnvSchema, parseEnv } from './client-schema';
export type { ClientEnv } from './client-schema';

/** Server-only secrets. Never import these from client code. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SECRET_KEY: optionalString,
  TMDB_API_READ_TOKEN: optionalString,
  DISCOGS_TOKEN: optionalString,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  BGG_API_TOKEN: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
