import { z } from 'zod';

/**
 * The browser-safe half of the env schemas: the `NEXT_PUBLIC_*` schema and the shared helpers.
 * `./client` imports only this module, so the server schema in `./schema` (whose keys name the
 * secrets) never reaches the client bundle (checked by `pnpm check:bundle`).
 *
 * Variables are optional until the task that introduces them makes them required (see `.env.example`).
 * Empty strings (e.g. an unfilled `KEY=` line) are treated as unset.
 */

export const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
export const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
);

/** Exposed to the browser. Must be prefixed `NEXT_PUBLIC_` so Next.js inlines them into the bundle. */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

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
