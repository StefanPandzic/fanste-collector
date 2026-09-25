// Runs the Supabase CLI with the repo-root env files loaded (FC-04). Used by the `db*` scripts in
// the root package.json, e.g. `pnpm db migration new <name>` or `pnpm db:push`.
//
// - `link` defaults to `--project-ref $SUPABASE_PROJECT_REF`; pass `--project-ref` to link another
//   project (e.g. prod).
// - `--include-seed` and `db reset` are refused unless they target the linked project and it is
//   `SUPABASE_PROJECT_REF` (dev), so the dev-only seed and resets can't reach prod.
// - The CLI itself reads `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` from the environment.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadRootEnv, repoRoot, requireEnv } from './lib/root-env.mjs';
import { runSupabase } from './lib/supabase-cli.mjs';

loadRootEnv();

const args = process.argv.slice(2);

if (args[0] === 'link' && !args.some((arg) => arg.startsWith('--project-ref'))) {
  args.push('--project-ref', requireEnv('SUPABASE_PROJECT_REF'));
}

// Seeding and `db reset` (which wipes the database, then seeds it) are dev-only: they must target
// the linked project, and that project must be dev.
const seeds = args.some((arg) => /^--include-seed(=|$)/.test(arg));
const resets = args[0] === 'db' && args[1] === 'reset';
if (seeds || resets) {
  const command = resets ? '`db reset`' : '--include-seed';
  if (args.some((arg) => /^--(project-ref|db-url)(=|$)/.test(arg))) {
    console.error(`${command} can't be combined with --project-ref or --db-url.`);
    process.exit(1);
  }
  const devRef = requireEnv('SUPABASE_PROJECT_REF');
  // Written by `supabase link`.
  const linkedRefFile = path.join(repoRoot, 'supabase/.temp/project-ref');
  const linkedRef = existsSync(linkedRefFile) ? readFileSync(linkedRefFile, 'utf8').trim() : '';
  if (linkedRef !== devRef) {
    console.error(
      `${command} is only allowed while linked to the dev project (SUPABASE_PROJECT_REF). ` +
        'Run `pnpm db:link` first.',
    );
    process.exit(1);
  }
}

process.exit(runSupabase(args).status);
