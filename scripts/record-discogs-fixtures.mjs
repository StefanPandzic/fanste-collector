// Records the Discogs responses the adapter tests replay (FC-10), so CI never calls Discogs.
// Responses are trimmed to the fields the adapter reads. Run with `pnpm fixtures:discogs`.
//
// Uses DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET when they're set. Without them Discogs still
// answers, at a lower rate limit, but search results come without cover images.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadRootEnv, repoRoot } from './lib/root-env.mjs';

loadRootEnv();
const key = process.env.DISCOGS_CONSUMER_KEY;
const secret = process.env.DISCOGS_CONSUMER_SECRET;
// The same User-Agent as the adapter (`discogsUserAgent`).
const contactUrl =
  process.env.DISCOGS_USER_AGENT_URL || 'https://github.com/StefanPandzic/fanste-collector';
if (!key || !secret) {
  console.warn('DISCOGS_CONSUMER_KEY/SECRET not set: search results will have no cover images.');
}

const outDir = path.join(repoRoot, 'apps/web/src/server/providers/discogs/__fixtures__');
const SEARCH_RESULTS_KEPT = 5;
const RELEASE_ID = 2607424; // The Beatles – Abbey Road, UK 1969 vinyl (Apple PCS 7088)
const MASTER_ID = 24047; // The Beatles – Abbey Road

async function get(pathname, params = {}) {
  const url = new URL(`https://api.discogs.com${pathname}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  const response = await fetch(url, {
    headers: {
      'User-Agent': `FansteCollector/1.0 +${contactUrl}`,
      Accept: 'application/vnd.discogs.v2.discogs+json',
      ...(key && secret ? { Authorization: `Discogs key=${key}, secret=${secret}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status}`);
  return response.json();
}

function pick(object, keys) {
  return Object.fromEntries(
    keys.filter((name) => name in object).map((name) => [name, object[name]]),
  );
}

const artistKeys = ['id', 'name', 'anv', 'join'];
const trackKeys = ['position', 'type_', 'title', 'duration'];
const imageKeys = ['type', 'uri', 'uri150'];

function trimItem(item) {
  return {
    ...pick(item, ['id', 'title', 'year', 'genres', 'styles', 'notes', 'uri']),
    artists: item.artists.map((artist) => pick(artist, artistKeys)),
    tracklist: item.tracklist.map((track) => ({
      ...pick(track, trackKeys),
      ...(track.sub_tracks
        ? { sub_tracks: track.sub_tracks.map((sub) => pick(sub, trackKeys)) }
        : {}),
    })),
    images: (item.images ?? []).slice(0, 2).map((image) => pick(image, imageKeys)),
  };
}

function trimRelease(release) {
  return {
    ...trimItem(release),
    ...pick(release, ['country', 'thumb', 'master_id']),
    labels: release.labels.map((label) => pick(label, ['name', 'catno'])),
    identifiers: (release.identifiers ?? []).map((identifier) =>
      pick(identifier, ['type', 'value', 'description']),
    ),
    formats: release.formats.map((format) => pick(format, ['name', 'qty', 'descriptions', 'text'])),
  };
}

const search = await get('/database/search', {
  q: 'abbey road',
  type: 'release',
  format: 'Vinyl',
  page: 1,
  per_page: 20,
});

const fixtures = {
  'search-abbey-road-vinyl.json': {
    pagination: pick(search.pagination, ['page', 'pages', 'items']),
    results: search.results
      .slice(0, SEARCH_RESULTS_KEPT)
      .map((result) =>
        pick(result, [
          'id',
          'type',
          'title',
          'year',
          'country',
          'format',
          'formats',
          'catno',
          'thumb',
          'cover_image',
        ]),
      ),
  },
  [`release-${RELEASE_ID}.json`]: trimRelease(await get(`/releases/${RELEASE_ID}`)),
  [`master-${MASTER_ID}.json`]: trimItem(await get(`/masters/${MASTER_ID}`)),
};

mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, name))}`);
}
