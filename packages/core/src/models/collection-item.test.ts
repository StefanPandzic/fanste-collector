import { describe, expect, it } from 'vitest';

import { collectionItemSchema } from './collection-item';

const row = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  format: '4K UHD Blu-ray',
  details: { edition: 'Steelbook' },
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: '2026-01-31',
  purchasePrice: 24.99,
  estimatedValue: null,
  currency: 'EUR',
  notes: null,
  source: 'search',
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
  metadata: null,
};

describe('collectionItemSchema', () => {
  it('accepts a Supabase row without cached metadata', () => {
    expect(collectionItemSchema.parse(row)).toEqual(row);
  });

  it('accepts a row with metadata', () => {
    const metadata = {
      provider: 'tmdb',
      externalId: 'movie:27205',
      category: 'movie',
      title: 'Inception',
      releaseYear: 2010,
    };
    expect(collectionItemSchema.parse({ ...row, metadata }).metadata).toEqual(metadata);
  });
});
