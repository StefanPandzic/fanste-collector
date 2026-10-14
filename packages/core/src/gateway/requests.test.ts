import { describe, expect, it } from 'vitest';

import {
  batchRequestSchema,
  batchResponseSchema,
  categoryOfExternalId,
  hasSearchTerm,
  itemRefSchema,
  MAX_BATCH_ITEMS,
  matchRequestSchema,
  matchResponseSchema,
  platformListResponseSchema,
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

  it('coerces an optional release year', () => {
    expect(searchQuerySchema.parse({ category: 'movie', q: 'Inception', year: '2010' }).year).toBe(
      2010,
    );
    expect(searchQuerySchema.parse({ category: 'movie', q: 'Inception' })).not.toHaveProperty(
      'year',
    );
  });

  it('accepts a physical music medium', () => {
    expect(
      searchQuerySchema.parse({ category: 'music', q: 'Abbey Road', format: 'Vinyl' }).format,
    ).toBe('Vinyl');
    expect(
      searchQuerySchema.safeParse({ category: 'music', q: 'Abbey Road', format: '8-track' })
        .success,
    ).toBe(false);
  });

  it('accepts a music lookup by code and country without a query', () => {
    expect(
      searchQuerySchema.parse({ category: 'music', code: 'EPC 450290 1', country: 'UK' }),
    ).toEqual({ category: 'music', q: '', page: 1, code: 'EPC 450290 1', country: 'UK' });
    expect(searchQuerySchema.safeParse({ category: 'movie', code: 'EPC 450290 1' }).success).toBe(
      false,
    );
  });

  it('coerces a game platform from the query string', () => {
    expect(
      searchQuerySchema.parse({ category: 'video_game', q: 'Elden Ring', platform: '167' })
        .platform,
    ).toBe(167);
    expect(
      searchQuerySchema.safeParse({ category: 'video_game', q: 'Elden Ring', platform: '0' })
        .success,
    ).toBe(false);
    expect(
      searchQuerySchema.safeParse({ category: 'video_game', q: 'Elden Ring', platform: 'PS5' })
        .success,
    ).toBe(false);
  });

  it('rejects an empty query and unknown categories', () => {
    expect(searchQuerySchema.safeParse({ category: 'movie', q: '   ' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ category: 'books', q: 'Dune' }).success).toBe(false);
  });
});

describe('hasSearchTerm', () => {
  it('needs a query, or a code for music', () => {
    expect(hasSearchTerm({ category: 'movie', q: 'Inception' })).toBe(true);
    expect(hasSearchTerm({ category: 'music', q: ' ', code: '5099745042210' })).toBe(true);
    expect(hasSearchTerm({ category: 'movie', q: '', code: '5099745042210' })).toBe(false);
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
    expect(itemRefSchema.safeParse({ provider: 'custom', externalId: 'pop-1' }).success).toBe(
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

describe('batchResponseSchema', () => {
  it('accepts missing refs with a reason', () => {
    const response = {
      items: [],
      missing: [
        { ...matrixRef, reason: 'not_found' },
        { provider: 'bgg', externalId: '13', reason: 'retry_later' },
      ],
    };
    expect(batchResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects missing refs without a known reason', () => {
    expect(batchResponseSchema.safeParse({ items: [], missing: [matrixRef] }).success).toBe(false);
    expect(
      batchResponseSchema.safeParse({ items: [], missing: [{ ...matrixRef, reason: 'gone' }] })
        .success,
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

describe('platformListResponseSchema', () => {
  it('accepts IGDB platforms with and without an abbreviation', () => {
    const platforms = [
      { id: 139, name: '1292 Advanced Programmable Video System' },
      { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    ];
    expect(platformListResponseSchema.parse({ platforms })).toEqual({ platforms });
    expect(platformListResponseSchema.safeParse({ platforms: [{ id: 167 }] }).success).toBe(false);
  });
});
