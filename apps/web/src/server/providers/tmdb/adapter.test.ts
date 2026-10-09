import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizedItemSchema, parseMovieExtra, parseTvExtra } from '@fanste/core';

import configuration from './__fixtures__/configuration.json';
import movieFixture from './__fixtures__/movie-27205.json';
import searchMovieFixture from './__fixtures__/search-movie-inception.json';
import searchTvFixture from './__fixtures__/search-tv-breaking-bad.json';
import tvFixture from './__fixtures__/tv-1396.json';
import { createTmdbAdapter } from './adapter';

const token = 'tmdb-read-access-token';
const emptySearch = { page: 1, total_pages: 0, total_results: 0, results: [] };

const fixtures: Record<string, unknown> = {
  '/3/configuration': configuration,
  '/3/search/movie': searchMovieFixture,
  '/3/search/tv': searchTvFixture,
  '/3/movie/27205': movieFixture,
  '/3/tv/1396': tvFixture,
};

function toUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function stubTmdb(respond: (url: URL) => unknown = (url) => fixtures[url.pathname]) {
  const fetchFn = vi.fn<typeof fetch>((input) => {
    const body = respond(toUrl(input));
    return Promise.resolve(
      body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
    );
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

function requestedUrls(fetchFn: ReturnType<typeof stubTmdb>): URL[] {
  return fetchFn.mock.calls.map(([input]) => toUrl(input));
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createTmdbAdapter', () => {
  it('finds Inception as the first movie result with a poster thumbnail', async () => {
    const fetchFn = stubTmdb();
    const adapter = createTmdbAdapter({ token });

    const response = await adapter.search('Inception', { category: 'movie', page: 1, year: 2010 });
    expect(response.results[0]).toEqual({
      provider: 'tmdb',
      externalId: 'movie:27205',
      category: 'movie',
      title: 'Inception',
      releaseYear: 2010,
      thumbnailUrl: 'https://image.tmdb.org/t/p/w185/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
    });
    expect(response).toMatchObject({ page: 1, totalPages: 1, totalResults: 12 });

    const search = requestedUrls(fetchFn).find((url) => url.pathname === '/3/search/movie');
    expect(search?.searchParams.get('query')).toBe('Inception');
    expect(search?.searchParams.get('year')).toBe('2010');
    expect(search?.searchParams.get('language')).toBe('en-US');
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toHaveProperty('Authorization', `Bearer ${token}`);
  });

  it('searches TV shows by first air year and clamps totalPages to 500', async () => {
    const fetchFn = stubTmdb((url) =>
      url.pathname === '/3/search/tv'
        ? { ...searchTvFixture, total_pages: 900 }
        : fixtures[url.pathname],
    );
    const response = await createTmdbAdapter({ token }).search('Breaking Bad', {
      category: 'tv',
      page: 1,
      year: 2008,
    });

    expect(response.results[0]?.externalId).toBe('tv:1396');
    expect(response.totalPages).toBe(500);
    const search = requestedUrls(fetchFn).find((url) => url.pathname === '/3/search/tv');
    expect(search?.searchParams.get('first_air_date_year')).toBe('2008');
  });

  it('returns a valid NormalizedItem for a movie and a TV show', async () => {
    const fetchFn = stubTmdb();
    const adapter = createTmdbAdapter({ token });

    const movie = normalizedItemSchema.parse(await adapter.getById('movie:27205', 'movie'));
    expect(movie).toMatchObject({ externalId: 'movie:27205', title: 'Inception' });
    expect(parseMovieExtra(movie.extra)).toMatchObject({ imdbId: 'tt1375666' });

    const show = normalizedItemSchema.parse(await adapter.getById('tv:1396', 'tv'));
    expect(show).toMatchObject({ externalId: 'tv:1396', title: 'Breaking Bad' });
    expect(parseTvExtra(show.extra)).toMatchObject({ imdbId: 'tt0903747' });

    const urls = requestedUrls(fetchFn);
    expect(
      urls.find((url) => url.pathname === '/3/movie/27205')?.searchParams.get('append_to_response'),
    ).toBe('credits,external_ids');
    expect(
      urls.find((url) => url.pathname === '/3/tv/1396')?.searchParams.get('append_to_response'),
    ).toBe('external_ids');
  });

  it('retries a match without the year when the year finds nothing', async () => {
    const fetchFn = stubTmdb((url) =>
      url.pathname === '/3/search/movie' && url.searchParams.has('year')
        ? emptySearch
        : fixtures[url.pathname],
    );
    const candidates = await createTmdbAdapter({ token }).matchMovie('Inception', 2011);

    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toMatchObject({
      item: { externalId: 'movie:27205' },
      popularity: 53.0331,
      originalTitle: 'Inception',
    });
    const searches = requestedUrls(fetchFn).filter((url) => url.pathname === '/3/search/movie');
    expect(searches.map((url) => url.searchParams.get('year'))).toEqual(['2011', null]);
  });
});
