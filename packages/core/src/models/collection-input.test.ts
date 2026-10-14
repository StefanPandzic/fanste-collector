import { describe, expect, it } from 'vitest';

import {
  addCustomItemInputSchema,
  addItemInputSchema,
  collectionFilterSchema,
  COLLECTION_FACETS,
  collectionQuerySchema,
  customItemDataPatchSchema,
  detailsPatchSchemaFor,
  overridesPatchSchema,
  tagInputSchema,
  updateItemPatchSchema,
} from './collection-input';

const inception = { category: 'movie', provider: 'tmdb', externalId: 'movie:27205' };
const funkoCollectionId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';

describe('addItemInputSchema', () => {
  it('accepts a provider item and trims the format', () => {
    expect(addItemInputSchema.parse({ ...inception, format: '  4K UHD Blu-ray ' })).toEqual({
      ...inception,
      format: '4K UHD Blu-ray',
    });
    expect(addItemInputSchema.parse({ ...inception, format: '   ' }).format).toBeNull();
  });

  it('rejects mismatched provider, category and ID, and custom items', () => {
    expect(addItemInputSchema.safeParse({ ...inception, category: 'music' }).success).toBe(false);
    expect(addItemInputSchema.safeParse({ ...inception, externalId: '27205' }).success).toBe(false);
    expect(
      addItemInputSchema.safeParse({ category: 'custom', provider: 'custom', externalId: 'pop-1' })
        .success,
    ).toBe(false);
  });

  it('checks details against the category schema', () => {
    expect(
      addItemInputSchema.parse({ ...inception, details: { audioLanguages: ['EN'] } }).details,
    ).toEqual({ audioLanguages: ['en'] });
    const result = addItemInputSchema.safeParse({ ...inception, details: { discCount: 0 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['details', 'discCount']);
  });
});

describe('addCustomItemInputSchema', () => {
  it('accepts an item of a custom collection and checks its details', () => {
    expect(
      addCustomItemInputSchema.parse({
        category: 'custom',
        customCollectionId: funkoCollectionId,
        customData: { title: ' Spider-Man ', identifier: '#123' },
        format: 'Physical',
        details: { condition: 'Mint', boxed: true },
      }),
    ).toEqual({
      category: 'custom',
      customCollectionId: funkoCollectionId,
      customData: { title: 'Spider-Man', identifier: '#123' },
      format: 'Physical',
      details: { condition: 'Mint', boxed: true },
    });
    expect(
      addCustomItemInputSchema.safeParse({
        category: 'custom',
        customCollectionId: funkoCollectionId,
        customData: { title: 'Spider-Man' },
        details: { condition: 'NM' },
      }).success,
    ).toBe(false);
  });

  it('accepts a hand-entered item of an integrated category without a collection', () => {
    expect(
      addCustomItemInputSchema.parse({ category: 'movie', customData: { title: 'Home video' } }),
    ).toEqual({ category: 'movie', customData: { title: 'Home video' } });
  });

  it('requires a collection exactly for the custom category', () => {
    const missing = addCustomItemInputSchema.safeParse({
      category: 'custom',
      customData: { title: 'Spider-Man' },
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['customCollectionId']);
    expect(
      addCustomItemInputSchema.safeParse({
        category: 'movie',
        customCollectionId: funkoCollectionId,
        customData: { title: 'Home video' },
      }).success,
    ).toBe(false);
  });
});

describe('customItemDataPatchSchema', () => {
  it('accepts set fields and null removals', () => {
    expect(customItemDataPatchSchema.parse({ title: ' Iron Man ', subtitle: null })).toEqual({
      title: 'Iron Man',
      subtitle: null,
    });
  });

  it('rejects removing the title', () => {
    expect(customItemDataPatchSchema.safeParse({ title: null }).success).toBe(false);
  });
});

describe('updateItemPatchSchema', () => {
  it('accepts a partial patch', () => {
    expect(updateItemPatchSchema.parse({ ownership: 'sold', estimatedValue: 12.5 })).toEqual({
      ownership: 'sold',
      estimatedValue: 12.5,
    });
  });

  it('rejects invalid values', () => {
    expect(updateItemPatchSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(updateItemPatchSchema.safeParse({ currency: 'eur' }).success).toBe(false);
    expect(updateItemPatchSchema.safeParse({ acquiredAt: '31.01.2026' }).success).toBe(false);
  });
});

describe('detailsPatchSchemaFor', () => {
  it('accepts set and removed fields of the category', () => {
    expect(detailsPatchSchemaFor('movie').parse({ resolution: '2160p', edition: null })).toEqual({
      resolution: '2160p',
      edition: null,
    });
    expect(detailsPatchSchemaFor('movie').safeParse({ discCount: 0 }).success).toBe(false);
    expect(detailsPatchSchemaFor('music').parse({ mediaCondition: 'NM', variant: null })).toEqual({
      mediaCondition: 'NM',
      variant: null,
    });
    expect(detailsPatchSchemaFor('music').safeParse({ mediaCondition: 'Mint' }).success).toBe(
      false,
    );
  });

  it('accepts set and removed fields of a video game copy', () => {
    expect(
      detailsPatchSchemaFor('video_game').parse({ platform: 'PlayStation 5', storefront: null }),
    ).toEqual({ platform: 'PlayStation 5', storefront: null });
    expect(detailsPatchSchemaFor('video_game').safeParse({ completeness: 'Boxed' }).success).toBe(
      false,
    );
  });
});

describe('overridesPatchSchema', () => {
  it('accepts set fields and null resets', () => {
    expect(
      overridesPatchSchema.parse({ title: ' Inception (Steelbook) ', imageUrl: null }),
    ).toEqual({ title: 'Inception (Steelbook)', imageUrl: null });
    expect(overridesPatchSchema.safeParse({ releaseYear: 'soon' }).success).toBe(false);
  });
});

describe('tagInputSchema', () => {
  it('accepts a trimmed name and a hex color', () => {
    expect(tagInputSchema.parse({ name: ' Steelbook ', color: '#3b82f6' })).toEqual({
      name: 'Steelbook',
      color: '#3b82f6',
    });
  });

  it('rejects an empty name and non-hex colors', () => {
    expect(tagInputSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(tagInputSchema.safeParse({ name: 'Steelbook', color: 'blue' }).success).toBe(false);
  });
});

describe('collectionQuerySchema', () => {
  it('fills in the sort and page defaults', () => {
    expect(collectionQuerySchema.parse({ category: 'movie' })).toEqual({
      category: 'movie',
      sort: 'added_desc',
      page: 1,
      pageSize: 60,
    });
  });

  it('accepts the acquired and value sorts', () => {
    expect(collectionQuerySchema.parse({ sort: 'acquired_desc' }).sort).toBe('acquired_desc');
    expect(collectionQuerySchema.parse({ sort: 'value_asc' }).sort).toBe('value_asc');
  });
});

describe('collectionFilterSchema', () => {
  it('accepts media, sources, an acquisition range and copy-details filters', () => {
    expect(
      collectionFilterSchema.parse({
        formats: ['4K UHD Blu-ray', 'DVD'],
        sources: ['scanner'],
        acquiredFrom: '2024-01-01',
        acquiredTo: '2024-12-31',
        details: { resolution: ['2160p'], hdr: ['Dolby Vision'], audioLanguages: ['en'] },
      }),
    ).toEqual({
      formats: ['4K UHD Blu-ray', 'DVD'],
      sources: ['scanner'],
      acquiredFrom: '2024-01-01',
      acquiredTo: '2024-12-31',
      details: { resolution: ['2160p'], hdr: ['Dolby Vision'], audioLanguages: ['en'] },
    });
  });

  it('accepts release countries and offers country counts', () => {
    expect(collectionFilterSchema.parse({ countries: ['UK', 'Yugoslavia'] })).toEqual({
      countries: ['UK', 'Yugoslavia'],
    });
    expect(COLLECTION_FACETS).toContain('country');
  });

  it('accepts platform and storefront filters and offers their counts', () => {
    expect(
      collectionFilterSchema.parse({
        details: { platform: ['PlayStation 5', 'PC (Microsoft Windows)'], storefront: ['Steam'] },
      }),
    ).toEqual({
      details: { platform: ['PlayStation 5', 'PC (Microsoft Windows)'], storefront: ['Steam'] },
    });
    expect(COLLECTION_FACETS).toContain('platform');
    expect(COLLECTION_FACETS).toContain('storefront');
  });

  it('accepts custom collection IDs and offers their counts', () => {
    expect(collectionFilterSchema.parse({ customCollectionIds: [funkoCollectionId] })).toEqual({
      customCollectionIds: [funkoCollectionId],
    });
    expect(collectionFilterSchema.safeParse({ customCollectionIds: ['funko'] }).success).toBe(
      false,
    );
    expect(COLLECTION_FACETS).toContain('customCollection');
  });

  it('rejects unknown sources and malformed dates', () => {
    expect(collectionFilterSchema.safeParse({ sources: ['import'] }).success).toBe(false);
    expect(collectionFilterSchema.safeParse({ acquiredFrom: '01.05.2024' }).success).toBe(false);
  });
});
