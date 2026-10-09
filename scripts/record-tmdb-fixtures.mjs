// Records the TMDB responses the adapter tests replay (FC-09), so CI never calls TMDB. Responses are
// trimmed to the fields the adapter reads. Run with `pnpm fixtures:tmdb` (needs TMDB_API_READ_TOKEN).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadRootEnv, repoRoot, requireEnv } from './lib/root-env.mjs';

loadRootEnv();
const token = requireEnv('TMDB_API_READ_TOKEN');

const outDir = path.join(repoRoot, 'apps/web/src/server/providers/tmdb/__fixtures__');
const SEARCH_RESULTS_KEPT = 5;

async function get(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  for (const [key, value] of Object.entries({ language: 'en-US', ...params })) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status}`);
  return response.json();
}

function pick(object, keys) {
  return Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]]));
}

function trimSearch(page, keys) {
  return {
    ...pick(page, ['page', 'total_pages', 'total_results']),
    results: page.results.slice(0, SEARCH_RESULTS_KEPT).map((result) => pick(result, keys)),
  };
}

const movieSearchKeys = [
  'id',
  'title',
  'original_title',
  'release_date',
  'poster_path',
  'popularity',
];
const tvSearchKeys = ['id', 'name', 'original_name', 'first_air_date', 'poster_path', 'popularity'];
const named = (list) => list.map((entry) => pick(entry, ['id', 'name']));

function trimMovie(movie) {
  return {
    ...pick(movie, [
      'id',
      'title',
      'original_title',
      'release_date',
      'overview',
      'tagline',
      'runtime',
      'imdb_id',
      'poster_path',
    ]),
    genres: named(movie.genres),
    credits: {
      crew: movie.credits.crew
        .filter((member) => member.job === 'Director')
        .map((member) => pick(member, ['id', 'name', 'job'])),
    },
    external_ids: pick(movie.external_ids, ['imdb_id']),
  };
}

function trimTv(show) {
  return {
    ...pick(show, [
      'id',
      'name',
      'original_name',
      'first_air_date',
      'overview',
      'status',
      'number_of_seasons',
      'number_of_episodes',
      'episode_run_time',
      'poster_path',
    ]),
    genres: named(show.genres),
    networks: named(show.networks),
    created_by: named(show.created_by),
    seasons: show.seasons.map((season) =>
      pick(season, ['season_number', 'name', 'episode_count', 'air_date']),
    ),
    external_ids: pick(show.external_ids, ['imdb_id']),
  };
}

const configuration = await get('/configuration');
const fixtures = {
  'configuration.json': {
    images: pick(configuration.images, ['secure_base_url', 'poster_sizes']),
  },
  'search-movie-inception.json': trimSearch(
    await get('/search/movie', { query: 'Inception', page: 1, include_adult: false }),
    movieSearchKeys,
  ),
  'search-tv-breaking-bad.json': trimSearch(
    await get('/search/tv', { query: 'Breaking Bad', page: 1, include_adult: false }),
    tvSearchKeys,
  ),
  'movie-27205.json': trimMovie(
    await get('/movie/27205', { append_to_response: 'credits,external_ids' }),
  ),
  'tv-1396.json': trimTv(await get('/tv/1396', { append_to_response: 'external_ids' })),
};

mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, name))}`);
}
