import { describe, expect, it } from 'vitest';

import { missingMetadataRefs } from './missing-metadata';
import { refKey } from '../repository/copies';

import type { CollectionItem } from '@fanste/core';

const base: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:603',
  format: null,
  details: {},
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: null,
  purchasePrice: null,
  estimatedValue: null,
  currency: null,
  notes: null,
  source: 'search',
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
  tagIds: [],
  metadata: null,
};

describe('refKey', () => {
  it('joins the provider and the external ID', () => {
    expect(refKey({ provider: 'tmdb', externalId: 'movie:603' })).toBe('tmdb:movie:603');
  });
});

describe('missingMetadataRefs', () => {
  it('lists provider items without metadata, deduplicated and sorted', () => {
    const items: CollectionItem[] = [
      base,
      { ...base, format: '4K UHD Blu-ray' },
      { ...base, category: 'music', provider: 'discogs', externalId: 'release:249504' },
      {
        ...base,
        externalId: 'movie:27205',
        metadata: {
          provider: 'tmdb',
          externalId: 'movie:27205',
          category: 'movie',
          title: 'Inception',
        },
      },
      { ...base, category: 'funko', provider: 'custom', externalId: null },
    ];
    expect(missingMetadataRefs(items, new Set())).toEqual([
      { provider: 'discogs', externalId: 'release:249504' },
      { provider: 'tmdb', externalId: 'movie:603' },
    ]);
  });

  it('leaves out refs in the skip set', () => {
    expect(missingMetadataRefs([base], new Set(['tmdb:movie:603']))).toEqual([]);
  });
});
