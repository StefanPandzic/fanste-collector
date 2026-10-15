import { describe, expect, it } from 'vitest';

import { exportLoadScope, pdfSource, progressLabel, sourceDescription } from './export-view';

import type { CollectionItem } from '@fanste/core';
import type { ExportGroupKey, ExportTarget } from '@fanste/export';

const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';

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

const targets: ExportTarget[] = [
  { key: 'movie', label: 'Movies', count: 12 },
  { key: 'music', label: 'Music', count: 3 },
  { key: `custom:${funkoId}`, label: 'Funko Pops', count: 5 },
];

const filterSource = { kind: 'filter', filter: { search: 'star' } } as const;

describe('exportLoadScope', () => {
  it('loads the whole scope in one query when every group is picked', () => {
    const picked = new Set(targets.map((target) => target.key));
    expect(exportLoadScope(filterSource, targets, picked)).toEqual({
      filters: [{ search: 'star' }],
    });
  });

  it('loads only the picked groups otherwise', () => {
    const picked = new Set<ExportGroupKey>(['music', `custom:${funkoId}`]);
    expect(exportLoadScope(filterSource, targets, picked)).toEqual({
      filters: [
        { search: 'star', category: 'music' },
        { search: 'star', category: 'custom', customCollectionIds: [funkoId] },
      ],
    });
  });

  it('loads the selected items of the picked groups by ID', () => {
    const source = { kind: 'selection', items: [inception, abbeyRoad] } as const;
    expect(exportLoadScope(source, targets, new Set<ExportGroupKey>(['music']))).toEqual({
      ids: [abbeyRoad.id],
    });
  });
});

describe('sourceDescription', () => {
  it('describes where the export starts from', () => {
    expect(sourceDescription({ kind: 'all' }, undefined)).toBe('Your whole collection.');
    expect(sourceDescription({ kind: 'selection', items: [inception] }, undefined)).toBe(
      'The 1 item you selected.',
    );
    expect(sourceDescription(filterSource, 12)).toBe('The 12 items matching your filters.');
    expect(sourceDescription(filterSource, undefined)).toBe('The items matching your filters.');
  });
});

describe('progressLabel', () => {
  it('shows how many items are loaded', () => {
    expect(progressLabel({ phase: 'items', loaded: 400, total: 5000 })).toBe(
      `Loading 400 of ${(5000).toLocaleString()} items…`,
    );
    expect(progressLabel({ phase: 'items', loaded: 0, total: 0 })).toBe('Loading items…');
    expect(progressLabel({ phase: 'metadata', loaded: 20, total: 80 })).toBe(
      'Loading details of 20 of 80 items…',
    );
  });

  it('shows the phases of a PDF', () => {
    expect(progressLabel({ phase: 'fonts', loaded: 0, total: 3 })).toBe('Loading fonts…');
    expect(progressLabel({ phase: 'covers', loaded: 120, total: 500 })).toBe(
      'Loading covers: 120 of 500…',
    );
    expect(progressLabel({ phase: 'pdf', loaded: 300, total: 500 })).toBe(
      'Building the PDF: 300 of 500 items…',
    );
  });
});

describe('pdfSource', () => {
  it('keeps the source of a grid catalog', () => {
    expect(pdfSource(filterSource, 'grid')).toBe(filterSource);
  });

  it('keeps only the copies the user has in the insurance list', () => {
    const wishlist = { ...abbeyRoad, ownership: 'wishlist' as const };
    expect(pdfSource({ kind: 'selection', items: [inception, wishlist] }, 'insurance')).toEqual({
      kind: 'selection',
      items: [inception],
    });
    expect(pdfSource({ kind: 'all' }, 'insurance')).toEqual({
      kind: 'filter',
      filter: { ownership: ['owned', 'loaned_out', 'preordered'] },
    });
    expect(
      pdfSource(
        { kind: 'filter', filter: { search: 'star', ownership: ['owned', 'sold'] } },
        'insurance',
      ),
    ).toEqual({ kind: 'filter', filter: { search: 'star', ownership: ['owned'] } });
  });

  it('returns null when the status filter leaves no copies the user has', () => {
    expect(
      pdfSource({ kind: 'filter', filter: { ownership: ['wishlist', 'sold'] } }, 'insurance'),
    ).toBeNull();
  });
});
