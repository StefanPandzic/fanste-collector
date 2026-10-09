// Runs the integration tests against the dev Supabase Cloud project, with the repo-root env files
// loaded: the RLS tests of `@fanste/supabase` (FC-05) and the repository/Realtime tests of
// `@fanste/collection` (FC-14). Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// and SUPABASE_SECRET_KEY (dev). CI runs it in the `DB drift` workflow; it isn't part of `pnpm test`,
// which stays offline. Extra arguments go to every Vitest run.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { loadRootEnv, repoRoot } from './lib/root-env.mjs';

loadRootEnv();

const require = createRequire(import.meta.url);
const vitestEntry = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const PACKAGES = ['packages/supabase', 'packages/collection'];

let failed = false;
for (const dir of PACKAGES) {
  const result = spawnSync(
    process.execPath,
    [vitestEntry, 'run', '--config', 'vitest.integration.config.ts', ...process.argv.slice(2)],
    { cwd: path.join(repoRoot, dir), stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
