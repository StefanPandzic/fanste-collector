import { describe, expect, it } from 'vitest';

import {
  addCopy,
  addToPage,
  applyPatch,
  isOptimisticId,
  matchesQuery,
  mergePages,
  mergeRecord,
  OPTIMISTIC_ID_PREFIX,
  removeCopy,
  removeFromPage,
  restoreToPage,
  undoAddToPage,
  updateInPage,
} from './cache-updates';

import type { CopiesByRef, ItemCopy } from '../repository/copies';
import type { CollectionPage } from '../repository/items';
import type { CollectionItem } from '@fanste/core';

const tagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';

const inception: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
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
  tagIds: [tagId],
  metadata: { provider: 'tmdb', externalId: 'movie:27205', category: 'movie', title: 'Inception' },
};

const matrix: CollectionItem = {
  ...inception,
  id: '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
  externalId: 'movie:603',
  tagIds: [],
  metadata: { provider: 'tmdb', externalId: 'movie:603', category: 'movie', title: 'The Matrix' },
};

const page: CollectionPage = { items: [matrix], total: 1, page: 1, pageSize: 60 };

const matrixCopy: ItemCopy = { id: matrix.id, format: '4K UHD Blu-ray', ownership: 'owned' };
const copies: CopiesByRef = { 'tmdb:movie:603': [matrixCopy], 'tmdb:movie:27205': [] };

describe('matchesQuery', () => {
  it('matches items that pass every filter', () => {
    expect(matchesQuery(inception, {})).toBe(true);
    expect(
      matchesQuery(inception, {
        category: 'movie',
        ownership: ['owned'],
        tagIds: [tagId],
        search: 'incep',
      }),
    ).toBe(true);
  });

  it('rejects items that fail a filter', () => {
    expect(matchesQuery(inception, { category: 'tv' })).toBe(false);
    expect(matchesQuery(inception, { ownership: ['wishlist'] })).toBe(false);
    expect(matchesQuery(matrix, { tagIds: [tagId] })).toBe(false);
    expect(matchesQuery(inception, { search: 'matrix' })).toBe(false);
  });

  it('applies the media, source, acquisition date and copy-details filters', () => {
    const steelbook: CollectionItem = {
      ...inception,
      acquiredAt: '2024-05-01',
      details: { resolution: '2160p', edition: 'Steelbook', audioLanguages: ['en', 'de'] },
    };
    expect(
      matchesQuery(steelbook, {
        formats: ['4K UHD Blu-ray'],
        sources: ['search'],
        acquiredFrom: '2024-01-01',
        acquiredTo: '2024-12-31',
        details: { resolution: ['2160p'], edition: ['Steelbook'], audioLanguages: ['de'] },
      }),
    ).toBe(true);
    expect(matchesQuery(steelbook, { formats: ['DVD'] })).toBe(false);
    expect(matchesQuery(steelbook, { sources: ['scanner'] })).toBe(false);
    expect(matchesQuery(steelbook, { acquiredFrom: '2025-01-01' })).toBe(false);
    expect(matchesQuery(steelbook, { details: { audioLanguages: ['fr'] } })).toBe(false);
  });

  it('searches the subtitle as well as the title', () => {
    const subtitled: CollectionItem = {
      ...inception,
      metadataOverrides: { subtitle: 'Christopher Nolan' },
    };
    expect(matchesQuery(subtitled, { search: 'nolan' })).toBe(true);
  });
});

describe('addToPage', () => {
  it('puts a new item at the top of the first newest-first page', () => {
    expect(addToPage(page, inception, {})).toEqual({
      ...page,
      items: [inception, matrix],
      total: 2,
    });
  });

  it('only raises the total on other pages and sorts', () => {
    expect(addToPage(page, inception, { sort: 'title_asc' })).toEqual({ ...page, total: 2 });
  });

  it('leaves the page alone when it already holds the item', () => {
    expect(addToPage(page, matrix, {})).toBe(page);
  });

  it('leaves the page alone when the item does not match the query', () => {
    expect(addToPage(page, inception, { category: 'tv' })).toBe(page);
  });
});

describe('applyPatch', () => {
  it('applies a valid patch', () => {
    expect(applyPatch(inception, { ownership: 'sold', notes: '  Sold at a flea market ' })).toEqual(
      {
        ...inception,
        ownership: 'sold',
        notes: 'Sold at a flea market',
      },
    );
  });

  it('leaves the item unchanged for an invalid patch', () => {
    expect(applyPatch(inception, { quantity: 0 })).toBe(inception);
  });
});

describe('mergeRecord', () => {
  it('sets present keys, removes null keys and keeps the rest', () => {
    expect(
      mergeRecord(
        { resolution: '1080p', edition: 'Steelbook', discCount: 2 },
        { resolution: '2160p', edition: null, discCount: undefined },
      ),
    ).toEqual({ resolution: '2160p', discCount: 2 });
  });
});

describe('updateInPage', () => {
  it('replaces the item with the given ID', () => {
    const updated = updateInPage(page, matrix.id, (item) => ({ ...item, quantity: 2 }));
    expect(updated.items[0]?.quantity).toBe(2);
    expect(updateInPage(page, inception.id, (item) => item)).toBe(page);
  });
});

describe('removeFromPage', () => {
  it('removes the items and lowers the total', () => {
    const full: CollectionPage = { ...page, items: [inception, matrix], total: 2 };
    expect(removeFromPage(full, new Set([inception.id]))).toEqual({ ...page, total: 1 });
    expect(removeFromPage(page, new Set([inception.id]))).toBe(page);
  });
});

describe('isOptimisticId', () => {
  it('recognizes temporary IDs of items still being added', () => {
    expect(isOptimisticId(`${OPTIMISTIC_ID_PREFIX}1`)).toBe(true);
    expect(isOptimisticId(inception.id)).toBe(false);
  });
});

describe('undoAddToPage', () => {
  it('removes the optimistic item from the page', () => {
    const optimistic: CollectionItem = { ...inception, id: `${OPTIMISTIC_ID_PREFIX}1` };
    const added: CollectionPage = { ...page, items: [optimistic, matrix], total: 2 };
    expect(undoAddToPage(added, optimistic.id)).toEqual(page);
  });

  it('lowers the total when the page only counted the item', () => {
    expect(undoAddToPage({ ...page, total: 2 }, `${OPTIMISTIC_ID_PREFIX}1`)).toEqual(page);
  });
});

describe('addCopy', () => {
  it('adds the copy to a lookup that asked for the item', () => {
    const copy: ItemCopy = { id: inception.id, format: 'Blu-ray', ownership: 'owned' };
    expect(addCopy(copies, 'tmdb:movie:27205', copy)).toEqual({
      ...copies,
      'tmdb:movie:27205': [copy],
    });
  });

  it('leaves other lookups and known copies alone', () => {
    expect(addCopy(copies, 'tmdb:tv:1396', matrixCopy)).toBe(copies);
    expect(addCopy(copies, 'tmdb:movie:603', matrixCopy)).toBe(copies);
  });
});

describe('removeCopy', () => {
  it('removes the copy and leaves the lookup alone when it lacks it', () => {
    expect(removeCopy(copies, 'tmdb:movie:603', matrix.id)).toEqual({
      ...copies,
      'tmdb:movie:603': [],
    });
    expect(removeCopy(copies, 'tmdb:movie:27205', matrix.id)).toBe(copies);
  });
});

describe('restoreToPage', () => {
  it('puts the item back at its index and raises the total', () => {
    expect(restoreToPage(page, inception, 0)).toEqual({
      ...page,
      items: [inception, matrix],
      total: 2,
    });
    expect(restoreToPage(page, matrix, 0)).toBe(page);
  });
});

describe('mergePages', () => {
  const first: CollectionPage = { items: [inception], total: 3, page: 1, pageSize: 1 };

  it('joins loaded pages in order and shows an item that moved to a later page once', () => {
    const second: CollectionPage = { items: [inception], total: 3, page: 2, pageSize: 1 };
    const third: CollectionPage = { items: [matrix], total: 3, page: 3, pageSize: 1 };
    expect(mergePages([first, second, third])).toEqual({
      items: [inception, matrix],
      hasMore: false,
    });
  });

  it('stops at the first page not loaded yet', () => {
    const third: CollectionPage = { items: [matrix], total: 3, page: 3, pageSize: 1 };
    expect(mergePages([first, undefined, third])).toEqual({ items: [inception], hasMore: true });
  });

  it('has nothing more after an empty page past the end', () => {
    const past: CollectionPage = { items: [], total: 1, page: 2, pageSize: 1 };
    expect(mergePages([{ ...first, total: 1 }, past])).toEqual({
      items: [inception],
      hasMore: false,
    });
    expect(mergePages([undefined])).toEqual({ items: [], hasMore: false });
  });
});
