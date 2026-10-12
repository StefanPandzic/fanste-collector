import { z } from 'zod';

import { optionalString, optionalUrl } from './client-schema';

/**
 * Env var schemas, shared by `./server` and `next.config.ts`, which validates them once at startup
 * so a bad value fails fast instead of on first use. The browser-safe part lives in
 * `./client-schema`; never import this module from `./client` or other client code.
 */

export { clientEnvSchema, parseEnv } from './client-schema';
export type { ClientEnv } from './client-schema';

/** Server-only env vars, mostly secrets. Never import these from client code. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SECRET_KEY: optionalString,
  TMDB_API_READ_TOKEN: optionalString,
  /** TMDB metadata language, e.g. `en-US` (the default) or `de-DE`. One per deployment (FC-09). */
  TMDB_LANGUAGE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Use an ISO 639-1 code, optionally with a region: en-US')
      .optional(),
  ),
  /** The Discogs app's Consumer Key + Secret (FC-10); FC-31 reuses them for the user OAuth flow. */
  DISCOGS_CONSUMER_KEY: optionalString,
  DISCOGS_CONSUMER_SECRET: optionalString,
  /** The contact URL in the `User-Agent` Discogs requires (FC-10); defaults to the repository. */
  DISCOGS_USER_AGENT_URL: optionalUrl,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  BGG_API_TOKEN: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
