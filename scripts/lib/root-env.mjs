import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/** Repository root (this file lives in `scripts/lib/`). */
export const repoRoot = path.resolve(import.meta.dirname, '../..');

/**
 * Loads the repo-root env files into `process.env` with the precedence Next.js uses (the same as
 * `apps/web/next.config.ts`). Variables that are already set (shell, CI) are never overridden.
 * Keep the file list in sync with `loadRootEnvFiles()` in `apps/web/next.config.ts`.
 */
export function loadRootEnv(mode = 'development') {
  const files = [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];

  for (const file of files) {
    const filePath = path.join(repoRoot, file);
    if (!existsSync(filePath)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(filePath, 'utf8')))) {
      process.env[key] ??= value;
    }
  }
}

/** Returns `process.env[name]`, or exits with a hint when it is unset or empty. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Add it to the repo-root .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}
