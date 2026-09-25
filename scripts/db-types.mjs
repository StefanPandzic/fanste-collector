// Generates the TypeScript types for the dev project's `public` schema into `@fanste/supabase`
// (FC-04). Run with `pnpm db:types` after every migration push, and commit the result.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import { loadRootEnv, repoRoot, requireEnv } from './lib/root-env.mjs';
import { runSupabase } from './lib/supabase-cli.mjs';

const outFile = path.join(repoRoot, 'packages/supabase/src/database.types.ts');

loadRootEnv();

const projectRef = requireEnv('SUPABASE_PROJECT_REF');
const { status, stdout } = runSupabase(
  ['gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public'],
  { captureStdout: true },
);
if (status !== 0) process.exit(status);
if (!stdout.trim()) {
  console.error('The CLI returned no types; database.types.ts was left unchanged.');
  process.exit(1);
}

// Format with the repo's Prettier config so `pnpm format:check` passes on the generated file.
const config = await prettier.resolveConfig(outFile);
const source = await prettier.format(stdout, { ...config, filepath: outFile });
writeFileSync(outFile, source);
console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
