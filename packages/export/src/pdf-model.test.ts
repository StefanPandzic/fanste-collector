import { describe, expect, it } from 'vitest';

import {
  attributionLine,
  buildPdfModel,
  coverUrls,
  insuranceDetails,
  modelTexts,
  valueTotals,
} from './pdf-model';

import type { CollectionItem, CustomCollection } from '@fanste/core';

const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';
const inceptionCover = 'https://image.tmdb.org/t/p/w185/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg';
const alienCover = 'https://image.tmdb.org/t/p/w185/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg';
const alienCustomCover = 'https://example.supabase.co/storage/v1/object/public/covers/alien.webp';

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
  details: { edition: 'Steelbook', discCount: 2, region: 'B' },
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 2,
  acquiredAt: '2026-03-14',
  purchasePrice: 29.99,
  estimatedValue: 25.99,
  currency: 'EUR',
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
    subtitle: 'Christopher Nolan',
    releaseYear: 2010,
    thumbnailUrl: inceptionCover,
  },
};

const inceptionBluRay: CollectionItem = {
  ...inception,
  id: '4a7d2f3b-9c5e-4d6f-8a1b-3c4d5e6f7a81',
  format: 'Blu-ray',
  details: {},
  quantity: 1,
  estimatedValue: null,
};

const alien: CollectionItem = {
  ...inception,
  id: '5b8e3a4c-0d6f-4e7a-9b2c-4d5e6f7a8b92',
  externalId: 'movie:348',
  details: {},
  quantity: 1,
  estimatedValue: null,
  metadataOverrides: { imageUrl: alienCustomCover },
  metadata: {
    provider: 'tmdb',
    externalId: 'movie:348',
    category: 'movie',
    title: 'Alien',
    releaseYear: 1979,
    thumbnailUrl: alienCover,
  },
};

const abbeyRoad: CollectionItem = {
  ...inception,
  id: '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
  category: 'music',
  provider: 'discogs',
  externalId: 'release:2607424',
  format: 'Vinyl',
  details: {},
  ownership: 'wishlist',
  quantity: 1,
  estimatedValue: 40,
  metadata: {
    provider: 'discogs',
    externalId: 'release:2607424',
    category: 'music',
    title: 'Abbey Road',
    subtitle: 'The Beatles',
  },
};

const eldenRing: CollectionItem = {
  ...inception,
  id: '8d3e5f7a-2b4c-4d6e-9f0a-1b2c3d4e5f6a',
  category: 'video_game',
  provider: 'igdb',
  externalId: 'game:119133',
  format: 'Disc',
  details: { platform: 'PlayStation 5' },
  ownership: 'loaned_out',
  quantity: 1,
  estimatedValue: 59.5,
  currency: 'USD',
  metadata: {
    provider: 'igdb',
    externalId: 'game:119133',
    category: 'video_game',
    title: 'Elden Ring',
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
  format: null,
  details: {},
  quantity: 1,
  estimatedValue: 12.5,
  metadata: {
    provider: 'custom',
    externalId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    category: 'custom',
    title: 'Spider-Man',
  },
};

const items = [spiderManPop, abbeyRoad, inception, eldenRing, alien, inceptionBluRay];
const collections = [funkoPops];

describe('buildPdfModel', () => {
  it('groups entries into sections in the app order, sorted by title', () => {
    const model = buildPdfModel(items, { layout: 'grid', collections });
    expect(model.sections.map((section) => section.label)).toEqual([
      'Movies',
      'Music',
      'Video Games',
      'Funko Pops',
    ]);
    expect(model.sections[0]?.entries.map((entry) => entry.title)).toEqual([
      'Alien',
      'Inception',
      'Inception',
    ]);
    expect(model.itemCount).toBe(6);
    expect(model.providers).toEqual(['tmdb', 'discogs', 'igdb']);
  });

  it('leaves wishlist and sold items out of the insurance list', () => {
    const sold = {
      ...alien,
      id: '6c9f4b5d-1e7a-4f8b-0c3d-5e6f7a8b9c03',
      ownership: 'sold' as const,
    };
    const model = buildPdfModel([...items, sold], { layout: 'insurance', collections });
    expect(model.sections.map((section) => section.label)).toEqual([
      'Movies',
      'Video Games',
      'Funko Pops',
    ]);
    expect(model.itemCount).toBe(5);
    expect(model.providers).toEqual(['tmdb', 'igdb']);
  });

  it('totals the values like the dashboard: copies the user has, value × quantity per currency', () => {
    const grid = buildPdfModel(items, { layout: 'grid', collections });
    const insurance = buildPdfModel(items, { layout: 'insurance', collections });
    const dashboard = [
      { currency: 'EUR', total: Math.round((25.99 * 2 + 12.5) * 100) / 100 },
      { currency: 'USD', total: 59.5 },
    ];
    expect(grid.totals).toEqual(dashboard);
    expect(insurance.totals).toEqual(dashboard);
    expect(grid.sections[0]?.totals).toEqual([{ currency: 'EUR', total: 51.98 }]);
  });
});

describe('valueTotals', () => {
  it('sums the valued entries in cents per currency, largest first', () => {
    const model = buildPdfModel([inception, abbeyRoad, eldenRing], { layout: 'grid', collections });
    const entries = model.sections.flatMap((section) => section.entries);
    expect(valueTotals(entries)).toEqual([
      { currency: 'USD', total: 59.5 },
      { currency: 'EUR', total: 51.98 },
    ]);
  });
});

describe('insuranceDetails', () => {
  it('lists the facts that tell a copy apart', () => {
    expect(insuranceDetails('movie', { edition: 'Steelbook', discCount: 2, region: 'B' })).toBe(
      'Steelbook · 2 discs · Region B',
    );
    expect(
      insuranceDetails('video_game', {
        platform: 'PlayStation 5',
        storefront: 'PlayStation Store',
        edition: "Collector's Edition",
        completeness: 'CIB',
      }),
    ).toBe("PlayStation 5 · PlayStation Store · Collector's Edition · CIB");
  });

  it('returns undefined without details', () => {
    expect(insuranceDetails('movie', { edition: 'Standard' })).toBeUndefined();
  });
});

describe('attributionLine', () => {
  it('names the metadata providers', () => {
    expect(attributionLine(['tmdb', 'discogs'])).toBe('Metadata: TMDB · Discogs');
    expect(attributionLine([])).toBeUndefined();
  });
});

describe('coverUrls', () => {
  it('lists the distinct covers of a grid, the custom cover first', () => {
    const model = buildPdfModel([inception, alien, inceptionBluRay], {
      layout: 'grid',
      collections,
    });
    expect(coverUrls(model)).toEqual([alienCustomCover, inceptionCover]);
  });

  it('keeps a custom cover when the metadata could not be loaded', () => {
    const model = buildPdfModel([{ ...alien, metadata: null }], { layout: 'grid', collections });
    expect(coverUrls(model)).toEqual([alienCustomCover]);
  });

  it('returns no covers for the insurance list', () => {
    const model = buildPdfModel([inception], { layout: 'insurance', collections });
    expect(coverUrls(model)).toEqual([]);
  });
});

describe('modelTexts', () => {
  it('collects the section labels and entry texts', () => {
    const texts = modelTexts(buildPdfModel([inception], { layout: 'grid', collections }));
    expect(texts).toContain('Movies');
    expect(texts).toContain('Inception');
    expect(texts).toContain('Christopher Nolan · 2010');
    expect(texts).toContain('Steelbook · 2 discs · Region B');
  });
});
