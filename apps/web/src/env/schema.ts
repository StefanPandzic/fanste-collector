import { z } from 'zod';

/**
 * Env var schemas, shared by the runtime env modules (`./server`, `./client`) and `next.config.ts`,
 * which validates them once at startup so a bad value fails fast instead of on first use.
 *
 * Variables are optional until the task that introduces them makes them required (see `.env.example`).
 * Empty strings (e.g. an unfilled `KEY=` line) are treated as unset.
 */

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.url().optional());

/** Exposed to the browser. Must be prefixed `NEXT_PUBLIC_` so Next.js inlines them into the bundle. */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
});

/** Server-only secrets. Never import these from client code. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  TMDB_API_READ_TOKEN: optionalString,
  DISCOGS_TOKEN: optionalString,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  BGG_API_TOKEN: optionalString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parses `source` with `schema`, throwing one readable error that lists every invalid variable. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, unknown>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
}
