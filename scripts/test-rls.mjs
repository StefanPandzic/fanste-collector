// Runs the RLS integration tests of `@fanste/supabase` against the dev Supabase Cloud project (FC-05),
// with the repo-root env files loaded. Needs NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (dev). CI runs it in the `DB drift`
// workflow; it isn't part of `pnpm test`, which stays offline.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { loadRootEnv, repoRoot } from './lib/root-env.mjs';

loadRootEnv();

const require = createRequire(import.meta.url);
const vitestEntry = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const result = spawnSync(
  process.execPath,
  [vitestEntry, 'run', '--config', 'vitest.integration.config.ts', ...process.argv.slice(2)],
  { cwd: path.join(repoRoot, 'packages/supabase'), stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
