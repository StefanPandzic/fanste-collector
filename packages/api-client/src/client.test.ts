import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, createApiClient } from './client';

import type { MatchQuery } from '@fanste/core';

const baseUrl = 'https://collector.example.com/';
const matrix = {
  provider: 'tmdb',
  externalId: 'movie:603',
  category: 'movie',
  title: 'The Matrix',
};

function fakeFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(() => Promise.resolve(Response.json(body, { status })));
}

describe('createApiClient', () => {
  it('builds search and item URLs and parses the responses', async () => {
    const searchFetch = fakeFetch({ results: [matrix], page: 2, totalPages: 3, totalResults: 41 });
    const client = createApiClient({ baseUrl, fetch: searchFetch });
    const response = await client.search({ category: 'movie', q: 'The Matrix', page: 2 });
    expect(searchFetch.mock.calls[0]?.[0]).toBe(
      'https://collector.example.com/api/search?category=movie&q=The+Matrix&page=2',
    );
    expect(response.results[0]?.title).toBe('The Matrix');

    const itemFetch = fakeFetch(matrix);
    const item = await createApiClient({ baseUrl, fetch: itemFetch }).getItem({
      provider: 'tmdb',
      externalId: 'movie:603',
    });
    expect(itemFetch.mock.calls[0]?.[0]).toBe(
      'https://collector.example.com/api/items/tmdb/movie%3A603',
    );
    expect(item).toEqual(matrix);
  });

  it('refreshes an item with a POST to its refresh URL', async () => {
    const fetchFn = fakeFetch(matrix);
    const item = await createApiClient({ baseUrl, fetch: fetchFn }).refreshItem({
      provider: 'tmdb',
      externalId: 'movie:603',
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'https://collector.example.com/api/items/tmdb/movie%3A603/refresh',
    );
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(item).toEqual(matrix);
  });

  it('sends the release year as a search param', async () => {
    const fetchFn = fakeFetch({ results: [], page: 1, totalPages: 0, totalResults: 0 });
    await createApiClient({ baseUrl, fetch: fetchFn }).search({
      category: 'movie',
      q: 'Inception',
      year: 2010,
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'https://collector.example.com/api/search?category=movie&q=Inception&year=2010',
    );
  });

  it('sends the access token as a Bearer header', async () => {
    const fetchFn = fakeFetch(matrix);
    const client = createApiClient({ baseUrl, fetch: fetchFn, getAccessToken: () => 'jwt-abc' });
    await client.getItem({ provider: 'tmdb', externalId: 'movie:603' });
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toHaveProperty('Authorization', 'Bearer jwt-abc');
  });

  it('throws an ApiClientError with the gateway code and provider', async () => {
    const fetchFn = fakeFetch(
      { error: { code: 'not_found', message: 'tmdb has no such item.', provider: 'tmdb' } },
      404,
    );
    const client = createApiClient({ baseUrl, fetch: fetchFn });
    const error: unknown = await client
      .getItem({ provider: 'tmdb', externalId: 'movie:999999' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', provider: 'tmdb' });
  });

  it('loads 50 items in one batch request', async () => {
    const fetchFn = fakeFetch({ items: [matrix], missing: [] });
    const refs = Array.from({ length: 50 }, (_, index) => ({
      provider: 'tmdb' as const,
      externalId: `movie:${index + 1}`,
    }));
    const response = await createApiClient({ baseUrl, fetch: fetchFn }).getItemsBatch(refs);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://collector.example.com/api/items/batch');
    expect(JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string)).toEqual({ items: refs });
    expect(response).toEqual({ items: [matrix], missing: [] });
  });

  it('matches 25 titles in two requests and keeps the query order', async () => {
    const batchSizes: number[] = [];
    const fetchFn = vi.fn<typeof fetch>((_url, init) => {
      const { queries } = JSON.parse(init?.body as string) as { queries: MatchQuery[] };
      batchSizes.push(queries.length);
      const results = queries.map((query) => ({
        candidates: [
          {
            item: { ...matrix, title: query.title },
            confidence: 0.9,
          },
        ],
      }));
      return Promise.resolve(Response.json({ results }));
    });
    const queries = Array.from({ length: 25 }, (_, index) => ({
      title: `The Matrix ${index + 1}`,
      kind: 'movie' as const,
    }));

    const response = await createApiClient({ baseUrl, fetch: fetchFn }).matchTmdb(queries);
    expect(batchSizes).toEqual([20, 5]);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://collector.example.com/api/match/tmdb');
    expect(response.results.map((result) => result.candidates[0]?.item.title)).toEqual(
      queries.map((query) => query.title),
    );
  });
});
