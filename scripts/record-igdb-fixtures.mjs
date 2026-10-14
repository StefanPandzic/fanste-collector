// Records the IGDB responses the adapter tests replay (FC-11), so CI never calls IGDB. Run with
// `pnpm fixtures:igdb`; needs TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET (a Twitch developer app).
//
// The queries are the adapter's own (`igdbSearchQuery`, `IGDB_GAME_FIELDS`, `IGDB_PLATFORM_QUERY`),
// copied here because this script is plain Node. Keep them in step with
// `apps/web/src/server/providers/igdb/queries.ts`.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadRootEnv, repoRoot } from './lib/root-env.mjs';

loadRootEnv();
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const outDir = path.join(repoRoot, 'apps/web/src/server/providers/igdb/__fixtures__');
const GAME_ID = 119133; // Elden Ring

const SEARCH_FIELDS =
  'fields name, first_release_date, cover.image_id, platforms.name, platforms.abbreviation, ' +
  'involved_companies.developer, involved_companies.company.name;';
const SEARCH_WHERE = 'where game_type = (0,2,4,8,9,10,11) & version_parent = null;';
const GAME_FIELDS =
  'fields name, summary, first_release_date, cover.image_id, genres.name, url, game_type, ' +
  'platforms.name, platforms.abbreviation, involved_companies.developer, ' +
  'involved_companies.publisher, involved_companies.company.name;';
const PLATFORM_QUERY = 'fields name, abbreviation; sort name asc; limit 500;';

const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }),
});
if (!tokenResponse.ok) throw new Error(`Twitch token: HTTP ${tokenResponse.status}`);
const { access_token: accessToken } = await tokenResponse.json();

async function post(endpoint, body) {
  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    body,
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  return { data: await response.json(), count: Number(response.headers.get('x-count') ?? 0) };
}

const search = await post(
  'games',
  `search "Elden Ring"; ${SEARCH_FIELDS} ${SEARCH_WHERE} limit 20; offset 0;`,
);
const game = await post('games', `${GAME_FIELDS} where id = ${GAME_ID};`);
const platforms = await post('platforms', PLATFORM_QUERY);

const fixtures = {
  // The adapter reads the total from `X-Count`; the fixture keeps it next to the body.
  'search-elden-ring.json': { count: search.count, body: search.data },
  [`game-${GAME_ID}.json`]: game.data,
  'platforms.json': platforms.data,
};

mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, name))}`);
}
