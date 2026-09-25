import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { repoRoot } from './root-env.mjs';

const require = createRequire(import.meta.url);
// The `supabase` npm package ships the CLI as a Node entry point, so it runs without a shell on
// every OS (no `.cmd` shims on Windows).
const cliEntry = path.join(
  path.dirname(require.resolve('supabase/package.json')),
  'dist/supabase.js',
);

/**
 * Runs the Supabase CLI from the repo root with the current `process.env`. Returns the exit status,
 * and stdout when `captureStdout` is set (stderr always goes to the terminal).
 */
export function runSupabase(args, { captureStdout = false } = {}) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    stdio: ['inherit', captureStdout ? 'pipe' : 'inherit', 'inherit'],
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}
