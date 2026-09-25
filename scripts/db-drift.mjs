// Fails when the linked Supabase Cloud project's `public` schema differs from what
// `supabase/migrations` describes, e.g. after a change made by hand in the dashboard (FC-04).
// `db diff` builds a shadow database from the migrations, so it needs Docker; CI runs it in the
// `DB drift` workflow (.github/workflows/db-drift.yml). Link the project first (`pnpm db:link`).
import { loadRootEnv } from './lib/root-env.mjs';
import { runSupabase } from './lib/supabase-cli.mjs';

loadRootEnv();

// Migration history: local files vs. migrations applied to the cloud project.
const history = runSupabase(['migration', 'list', '--linked']);
if (history.status !== 0) process.exit(history.status);

const diff = runSupabase(['db', 'diff', '--linked', '--schema', 'public'], { captureStdout: true });
if (diff.status !== 0) process.exit(diff.status);

// The diff SQL goes to stdout. Ignore the "no changes" notice in case a CLI version prints it there
// instead of on stderr.
const diffSql = diff.stdout.replace(/^.*No schema changes found.*$/gim, '').trim();
if (diffSql) {
  console.error('\nSchema drift: the linked project differs from supabase/migrations:\n');
  console.error(diffSql);
  console.error('Capture the change in a migration (`pnpm db migration new <name>`) instead.');
  process.exit(1);
}
console.log('No schema drift.');
