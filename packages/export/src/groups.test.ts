import { describe, expect, it } from 'vitest';

import { exportTargets, groupForExport, groupKeyOf, targetFilters, targetsOfItems } from './groups';

import type { CollectionItem, CustomCollection } from '@fanste/core';

const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';
const legoId = '6d4e2f1a-9b8c-4d7e-8f6a-5b4c3d2e1f0a';

function collection(id: string, name: string, sortOrder: number): CustomCollection {
  return {
    id,
    name,
    description: null,
    icon: 'shapes',
    sortOrder,
    createdAt: '2026-09-25T14:02:32.123456+00:00',
    updatedAt: '2026-09-25T14:02:32.123456+00:00',
  };
}

const collections = [collection(legoId, 'LEGO', 1), collection(funkoId, 'Funko Pops', 0)];

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
  metadata: null,
};

const abbeyRoad: CollectionItem = {
  ...inception,
  id: '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
  category: 'music',
  provider: 'discogs',
  externalId: 'release:2607424',
};

const spiderManPop: CollectionItem = {
  ...inception,
  id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
  category: 'custom',
  provider: 'custom',
  externalId: null,
  customCollectionId: funkoId,
  customData: { title: 'Spider-Man', identifier: '#593' },
};

const millenniumFalcon: CollectionItem = {
  ...spiderManPop,
  id: '4b5c6d7e-8f9a-4b0c-8d1e-2f3a4b5c6d7e',
  customCollectionId: legoId,
  customData: { title: 'Millennium Falcon', identifier: '75192' },
};

const counts = {
  category: { movie: 12, tv: 0, music: 3, custom: 7 },
  customCollection: { [funkoId]: 5, [legoId]: 2 },
};

describe('exportTargets', () => {
  it('lists the groups with items in the app order, collections in the user order', () => {
    expect(exportTargets(counts, collections)).toEqual([
      { key: 'movie', label: 'Movies', count: 12 },
      { key: 'music', label: 'Music', count: 3 },
      { key: `custom:${funkoId}`, label: 'Funko Pops', count: 5 },
      { key: `custom:${legoId}`, label: 'LEGO', count: 2 },
    ]);
  });

  it('keeps only the groups inside the base filter', () => {
    expect(exportTargets(counts, collections, { category: 'music' })).toEqual([
      { key: 'music', label: 'Music', count: 3 },
    ]);
    expect(
      exportTargets(counts, collections, { category: 'custom', customCollectionIds: [legoId] }),
    ).toEqual([{ key: `custom:${legoId}`, label: 'LEGO', count: 2 }]);
  });
});

describe('targetsOfItems', () => {
  it('counts the items of each group', () => {
    expect(
      targetsOfItems([millenniumFalcon, inception, abbeyRoad, inception], collections),
    ).toEqual([
      { key: 'movie', label: 'Movies', count: 2 },
      { key: 'music', label: 'Music', count: 1 },
      { key: `custom:${legoId}`, label: 'LEGO', count: 1 },
    ]);
  });
});

describe('targetFilters', () => {
  it('makes one filter per category and one for all picked collections', () => {
    const base = { search: 'star' };
    expect(
      targetFilters(base, ['movie', `custom:${funkoId}`, 'music', `custom:${legoId}`]),
    ).toEqual([
      { search: 'star', category: 'movie' },
      { search: 'star', category: 'music' },
      { search: 'star', category: 'custom', customCollectionIds: [funkoId, legoId] },
    ]);
  });
});

describe('groupForExport', () => {
  it('splits the items into ordered groups', () => {
    const groups = groupForExport(
      [millenniumFalcon, abbeyRoad, spiderManPop, inception],
      collections,
    );
    expect(groups.map((group) => [group.key, group.label])).toEqual([
      ['movie', 'Movies'],
      ['music', 'Music'],
      [`custom:${funkoId}`, 'Funko Pops'],
      [`custom:${legoId}`, 'LEGO'],
    ]);
    expect(groups[2]?.items).toEqual([spiderManPop]);
  });
});

describe('groupKeyOf', () => {
  it('uses the category, or the custom collection of a custom item', () => {
    expect(groupKeyOf(inception)).toBe('movie');
    expect(groupKeyOf(spiderManPop)).toBe(`custom:${funkoId}`);
  });
});
