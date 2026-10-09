import { describe, expect, it } from 'vitest';

import {
  batchRequestSchema,
  categoryOfExternalId,
  itemRefSchema,
  MAX_BATCH_ITEMS,
  matchRequestSchema,
  matchResponseSchema,
  searchQuerySchema,
} from './requests';

const matrixRef = { provider: 'tmdb', externalId: 'movie:603' };

describe('searchQuerySchema', () => {
  it('coerces the page from the query string and defaults it to 1', () => {
    expect(searchQuerySchema.parse({ category: 'movie', q: ' The Matrix ', page: '2' })).toEqual({
      category: 'movie',
      q: 'The Matrix',
      page: 2,
    });
    expect(searchQuerySchema.parse({ category: 'board_game', q: 'Catan' }).page).toBe(1);
  });

  it('rejects an empty query and unknown categories', () => {
    expect(searchQuerySchema.safeParse({ category: 'movie', q: '   ' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ category: 'books', q: 'Dune' }).success).toBe(false);
  });
});

describe('categoryOfExternalId', () => {
  it('reads the category from the external ID', () => {
    expect(categoryOfExternalId('tmdb', 'movie:603')).toBe('movie');
    expect(categoryOfExternalId('tmdb', 'tv:1396')).toBe('tv');
    expect(categoryOfExternalId('discogs', 'release:249504')).toBe('music');
    expect(categoryOfExternalId('bgg', '13')).toBe('board_game');
  });

  it('returns undefined for IDs the provider does not use', () => {
    expect(categoryOfExternalId('tmdb', '603')).toBeUndefined();
    expect(categoryOfExternalId('igdb', 'movie:603')).toBeUndefined();
  });
});

describe('itemRefSchema', () => {
  it('accepts a valid provider item', () => {
    expect(itemRefSchema.parse(matrixRef)).toEqual(matrixRef);
  });

  it('rejects invalid external IDs and the custom provider', () => {
    expect(itemRefSchema.safeParse({ provider: 'tmdb', externalId: '603' }).success).toBe(false);
    expect(itemRefSchema.safeParse({ provider: 'custom', externalId: 'funko-1' }).success).toBe(
      false,
    );
  });
});

describe('batchRequestSchema', () => {
  it('accepts between one and MAX_BATCH_ITEMS refs', () => {
    expect(batchRequestSchema.safeParse({ items: [matrixRef] }).success).toBe(true);
    expect(batchRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      batchRequestSchema.safeParse({
        items: Array.from({ length: MAX_BATCH_ITEMS + 1 }, () => matrixRef),
      }).success,
    ).toBe(false);
  });
});

describe('matchRequestSchema', () => {
  it('accepts between one and 20 queries', () => {
    const query = { title: 'The Matrix', year: 1999, kind: 'movie' };
    expect(matchRequestSchema.safeParse({ queries: [query] }).success).toBe(true);
    expect(matchRequestSchema.safeParse({ queries: [] }).success).toBe(false);
    expect(
      matchRequestSchema.safeParse({ queries: Array.from({ length: 21 }, () => query) }).success,
    ).toBe(false);
  });
});

describe('matchResponseSchema', () => {
  it('accepts candidates with a confidence between 0 and 1', () => {
    const item = { ...matrixRef, category: 'movie', title: 'The Matrix', releaseYear: 1999 };
    expect(
      matchResponseSchema.safeParse({ results: [{ candidates: [{ item, confidence: 0.95 }] }] })
        .success,
    ).toBe(true);
    expect(
      matchResponseSchema.safeParse({ results: [{ candidates: [{ item, confidence: 1.5 }] }] })
        .success,
    ).toBe(false);
  });
});
