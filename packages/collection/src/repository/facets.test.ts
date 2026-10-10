import { describe, expect, it } from 'vitest';

import { COLLECTION_FACETS } from '@fanste/core';

import { toCollectionFacets } from './facets';

describe('toCollectionFacets', () => {
  it('folds the rows into counts per facet and value', () => {
    const facets = toCollectionFacets([
      { facet: 'format', value: 'Blu-ray', item_count: 12 },
      { facet: 'format', value: 'DVD', item_count: 3 },
      { facet: 'resolution', value: '2160p', item_count: 5 },
    ]);
    expect(facets.format).toEqual({ 'Blu-ray': 12, DVD: 3 });
    expect(facets.resolution).toEqual({ '2160p': 5 });
    expect(facets.tag).toEqual({});
    expect(Object.keys(facets)).toEqual([...COLLECTION_FACETS]);
  });

  it('drops unknown facets', () => {
    expect(
      toCollectionFacets([{ facet: 'platform', value: 'PS5', item_count: 2 }]),
    ).not.toHaveProperty('platform');
  });
});
