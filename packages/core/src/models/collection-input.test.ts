import { describe, expect, it } from 'vitest';

import {
  addItemInputSchema,
  collectionQuerySchema,
  tagInputSchema,
  updateItemPatchSchema,
} from './collection-input';

const inception = { category: 'movie', provider: 'tmdb', externalId: 'movie:27205' };

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
      addItemInputSchema.safeParse({ category: 'funko', provider: 'custom', externalId: 'pop-1' })
        .success,
    ).toBe(false);
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
});
