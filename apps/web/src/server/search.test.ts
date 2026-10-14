import { describe, expect, it, vi } from 'vitest';

import { createLruCache } from './cache/lru';
import { createRegistry } from './providers/registry';
import { createSearchService } from './search';

import type { ProviderAdapter } from './providers/types';
import type { SearchResponse } from '@fanste/core';

const matrixPage: SearchResponse = {
  results: [{ provider: 'tmdb', externalId: 'movie:603', category: 'movie', title: 'The Matrix' }],
  page: 1,
  totalPages: 1,
  totalResults: 1,
};

const abbeyRoadPage: SearchResponse = {
  results: [
    {
      provider: 'discogs',
      externalId: 'release:2607424',
      category: 'music',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
    },
  ],
  page: 1,
  totalPages: 1,
  totalResults: 1,
};

const eldenRingPage: SearchResponse = {
  results: [
    {
      provider: 'igdb',
      externalId: '119133',
      category: 'video_game',
      title: 'Elden Ring',
      subtitle: 'FromSoftware',
    },
  ],
  page: 1,
  totalPages: 1,
  totalResults: 1,
};

describe('createSearchService', () => {
  it('serves a repeated search from the cache', async () => {
    const search = vi.fn<ProviderAdapter['search']>(() => Promise.resolve(matrixPage));
    const adapter: ProviderAdapter = {
      provider: 'tmdb',
      categories: ['movie', 'tv'],
      search,
      getById: () => Promise.reject(new Error('not used')),
    };
    const service = createSearchService({
      registry: createRegistry([adapter]),
      cache: createLruCache<SearchResponse>({ maxEntries: 10, ttlMs: 60_000 }),
    });

    expect(await service.search({ category: 'movie', q: 'The Matrix', page: 1 })).toEqual(
      matrixPage,
    );
    expect(await service.search({ category: 'movie', q: 'the matrix ', page: 1 })).toEqual(
      matrixPage,
    );
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('The Matrix', { category: 'movie', page: 1 });
  });

  it('passes the year to the provider and caches each year separately', async () => {
    const search = vi.fn<ProviderAdapter['search']>(() => Promise.resolve(matrixPage));
    const adapter: ProviderAdapter = {
      provider: 'tmdb',
      categories: ['movie', 'tv'],
      search,
      getById: () => Promise.reject(new Error('not used')),
    };
    const service = createSearchService({
      registry: createRegistry([adapter]),
      cache: createLruCache<SearchResponse>({ maxEntries: 10, ttlMs: 60_000 }),
    });

    await service.search({ category: 'movie', q: 'The Matrix', page: 1, year: 1999 });
    await service.search({ category: 'movie', q: 'The Matrix', page: 1, year: 1999 });
    await service.search({ category: 'movie', q: 'The Matrix', page: 1 });
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(1, 'The Matrix', {
      category: 'movie',
      page: 1,
      year: 1999,
    });
  });
  it('passes the music format to the provider and caches each format separately', async () => {
    const search = vi.fn<ProviderAdapter['search']>(() => Promise.resolve(abbeyRoadPage));
    const adapter: ProviderAdapter = {
      provider: 'discogs',
      categories: ['music'],
      search,
      getById: () => Promise.reject(new Error('not used')),
    };
    const service = createSearchService({
      registry: createRegistry([adapter]),
      cache: createLruCache<SearchResponse>({ maxEntries: 10, ttlMs: 60_000 }),
    });

    await service.search({ category: 'music', q: 'Abbey Road', page: 1, format: 'Vinyl' });
    await service.search({ category: 'music', q: 'Abbey Road', page: 1, format: 'CD' });
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(1, 'Abbey Road', {
      category: 'music',
      page: 1,
      format: 'Vinyl',
    });
  });
  it('passes the country and code to the provider and caches each separately', async () => {
    const search = vi.fn<ProviderAdapter['search']>(() => Promise.resolve(abbeyRoadPage));
    const adapter: ProviderAdapter = {
      provider: 'discogs',
      categories: ['music'],
      search,
      getById: () => Promise.reject(new Error('not used')),
    };
    const service = createSearchService({
      registry: createRegistry([adapter]),
      cache: createLruCache<SearchResponse>({ maxEntries: 10, ttlMs: 60_000 }),
    });

    await service.search({ category: 'music', q: '', page: 1, country: 'UK', code: 'PCS 7088' });
    await service.search({ category: 'music', q: '', page: 1, country: 'US', code: 'PCS 7088' });
    await service.search({ category: 'music', q: '', page: 1, country: 'UK', code: 'PCS 7067' });
    expect(search).toHaveBeenCalledTimes(3);
    expect(search).toHaveBeenNthCalledWith(1, '', {
      category: 'music',
      page: 1,
      country: 'UK',
      code: 'PCS 7088',
    });
  });

  it('passes the game platform to the provider and caches each platform separately', async () => {
    const search = vi.fn<ProviderAdapter['search']>(() => Promise.resolve(eldenRingPage));
    const adapter: ProviderAdapter = {
      provider: 'igdb',
      categories: ['video_game'],
      search,
      getById: () => Promise.reject(new Error('not used')),
    };
    const service = createSearchService({
      registry: createRegistry([adapter]),
      cache: createLruCache<SearchResponse>({ maxEntries: 10, ttlMs: 60_000 }),
    });

    await service.search({ category: 'video_game', q: 'Elden Ring', page: 1, platform: 167 });
    await service.search({ category: 'video_game', q: 'Elden Ring', page: 1, platform: 167 });
    await service.search({ category: 'video_game', q: 'Elden Ring', page: 1, platform: 6 });
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(1, 'Elden Ring', {
      category: 'video_game',
      page: 1,
      platform: 167,
    });
  });
});
