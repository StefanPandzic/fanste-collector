// Verifies that no server-only secret reached the browser bundle of the web app (FC-04). Run after
// `pnpm build`; CI runs it as the `Check client bundle` step.
//
// It searches what Next.js serves to the browser for the names of the secret env vars and, when they
// are set, for their values:
// - `.next/static`: the client JavaScript and CSS
// - `.next/server/app`: the prerendered HTML and RSC payloads (props passed to Client Components)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadRootEnv, repoRoot } from './lib/root-env.mjs';

const nextDir = path.join(repoRoot, 'apps/web/.next');
const SCANNED = [
  { dir: path.join(nextDir, 'static'), include: () => true },
  {
    dir: path.join(nextDir, 'server/app'),
    include: (name) => /\.(html|rsc|body)$/.test(name),
  },
];

const SECRET_ENV_VARS = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_ACCESS_TOKEN',
  'TMDB_API_READ_TOKEN',
  'DISCOGS_TOKEN',
  'TWITCH_CLIENT_SECRET',
  'BGG_API_TOKEN',
];

for (const { dir } of SCANNED) {
  if (!existsSync(dir)) {
    console.error(`${path.relative(repoRoot, dir)} not found. Run \`pnpm build\` first.`);
    process.exit(1);
  }
}

loadRootEnv('production');

// Labels never include the secret itself, so a failure doesn't print it to the CI log.
const needles = SECRET_ENV_VARS.flatMap((name) => {
  const value = process.env[name];
  const nameNeedle = { label: name, text: name };
  return value ? [nameNeedle, { label: `${name} value`, text: value }] : [nameNeedle];
});

const leaks = [];
let fileCount = 0;
for (const { dir, include } of SCANNED) {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !include(entry.name)) continue;
    fileCount++;
    const filePath = path.join(entry.parentPath, entry.name);
    const content = readFileSync(filePath, 'utf8');
    for (const needle of needles) {
      if (content.includes(needle.text)) {
        leaks.push(`${needle.label} in ${path.relative(repoRoot, filePath)}`);
      }
    }
  }
}

if (leaks.length > 0) {
  console.error(`Server-only secrets found in the client bundle:\n  - ${leaks.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `No server-only secrets in the client bundle (${needles.length} needles, ${fileCount} files).`,
);
