import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildCollectionExport } from './collection-export';

import type { CollectionItem, CustomCollection } from '@fanste/core';

const exportDate = new Date(2026, 9, 15, 10, 0);
const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';

const funkoPops: CustomCollection = {
  id: funkoId,
  name: 'Funko Pops',
  description: null,
  icon: 'shapes',
  sortOrder: 0,
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
};

const inception: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  customCollectionId: null,
  customData: null,
  format: '4K UHD Blu-ray',
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
  metadata: {
    provider: 'tmdb',
    externalId: 'movie:27205',
    category: 'movie',
    title: 'Inception',
    releaseYear: 2010,
  },
};

const spiderManPop: CollectionItem = {
  ...inception,
  id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
  category: 'custom',
  provider: 'custom',
  externalId: null,
  customCollectionId: funkoId,
  customData: { title: 'Spider-Man', identifier: '#593' },
  metadata: {
    provider: 'custom',
    externalId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    category: 'custom',
    title: 'Spider-Man',
  },
};

const options = { tags: [], collections: [funkoPops], date: exportDate };

describe('buildCollectionExport', () => {
  it('builds one CSV of every item', () => {
    const file = buildCollectionExport([inception, spiderManPop], { ...options, layout: 'single' });
    expect(file.name).toBe('fanste-collection-2026-10-15.csv');
    expect(file.type).toBe('csv');
    expect(file.mimeType).toBe('text/csv');
    expect(typeof file.data).toBe('string');
    expect(file.data).toContain('Inception');
    expect(file.data).toContain('Spider-Man');
  });

  it('builds a ZIP with one CSV per group', () => {
    const file = buildCollectionExport([inception, spiderManPop], {
      ...options,
      layout: 'per-group',
    });
    expect(file.name).toBe('fanste-collection-2026-10-15.zip');
    expect(file.mimeType).toBe('application/zip');
    const files = unzipSync(file.data as Uint8Array);
    expect(Object.keys(files)).toEqual([
      'fanste-collection-2026-10-15-movies.csv',
      'fanste-collection-2026-10-15-funko-pops.csv',
    ]);
    const moviesBytes = files['fanste-collection-2026-10-15-movies.csv'] ?? new Uint8Array();
    expect([...moviesBytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const movies = strFromU8(moviesBytes);
    expect(movies).toContain('Inception');
    expect(movies).not.toContain('Spider-Man');
    expect(movies).not.toContain('Number / code');
  });
});
