import { describe, expect, it } from 'vitest';

import { createRegistry, providerForCategory } from './registry';

import type { ProviderAdapter } from './types';

const tmdbAdapter: ProviderAdapter = {
  provider: 'tmdb',
  categories: ['movie', 'tv'],
  search: () => Promise.resolve({ results: [], page: 1, totalPages: 0, totalResults: 0 }),
  getById: (externalId, category) =>
    Promise.resolve({ provider: 'tmdb', externalId, category, title: 'The Matrix' }),
};

describe('providerForCategory', () => {
  it('maps categories to their provider', () => {
    expect(providerForCategory('tv')).toBe('tmdb');
    expect(providerForCategory('music')).toBe('discogs');
    expect(providerForCategory('board_game')).toBe('bgg');
    expect(providerForCategory('funko')).toBeUndefined();
  });
});

describe('createRegistry', () => {
  it('finds the adapter by category and provider', () => {
    const registry = createRegistry([tmdbAdapter]);
    expect(registry.forCategory('movie')).toBe(tmdbAdapter);
    expect(registry.forProvider('tmdb')).toBe(tmdbAdapter);
  });

  it('rejects categories without a provider and providers without an adapter', () => {
    const registry = createRegistry([tmdbAdapter]);
    expect(() => registry.forCategory('funko')).toThrow(
      expect.objectContaining({ code: 'unsupported_category' }),
    );
    expect(() => registry.forCategory('music')).toThrow(
      expect.objectContaining({ code: 'provider_not_configured', provider: 'discogs' }),
    );
  });
});
