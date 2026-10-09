import { describe, expect, it } from 'vitest';

import { searchResponseSchema } from './search';

const breakingBad = {
  provider: 'tmdb',
  externalId: 'tv:1396',
  category: 'tv',
  title: 'Breaking Bad',
  releaseYear: 2008,
  thumbnailUrl: 'https://image.tmdb.org/t/p/w185/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
};

describe('searchResponseSchema', () => {
  it('parses a page of results', () => {
    const page = { results: [breakingBad], page: 1, totalPages: 1, totalResults: 1 };
    expect(searchResponseSchema.parse(page)).toEqual(page);
  });

  it('rejects a result with an invalid external ID', () => {
    const result = searchResponseSchema.safeParse({
      results: [{ ...breakingBad, externalId: 'movie:1396' }],
      page: 1,
      totalPages: 1,
      totalResults: 1,
    });
    expect(result.success).toBe(false);
  });
});
