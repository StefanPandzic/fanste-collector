import { describe, expect, it } from 'vitest';

import {
  advanceSession,
  confidenceLabel,
  fixCandidates,
  fixSummary,
  initialSearch,
  moveIndex,
  removesCurrentItem,
  searchYear,
} from './fix-match-view';

import type { ScannedFile } from '@fanste/collection';
import type { SearchResult } from '@fanste/core';

const inceptionResult: SearchResult = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
};

const duneResult: SearchResult = {
  provider: 'tmdb',
  externalId: 'movie:438631',
  category: 'movie',
  title: 'Dune',
  releaseYear: 2021,
};

const inception: ScannedFile = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  deviceId: '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c',
  pathKey: 'e:/movies/inception (2010)/inception.mkv',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.mkv',
  size: 4_294_967_296,
  modifiedAt: '2026-09-01T18:30:00+00:00',
  parsedTitle: 'Inception',
  parsedYear: 2010,
  mediaInfo: null,
  matchStatus: 'manual',
  matchConfidence: null,
  matchCandidates: null,
  collectionItemId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  scannedAt: '2026-10-10T12:00:00.000Z',
  removedAt: null,
  subtitleLanguages: ['en'],
};

const inception4k: ScannedFile = {
  ...inception,
  id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
  pathKey: 'e:/movies/inception (2010)/inception.2010.2160p.mkv',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.2010.2160p.mkv',
};

describe('fixCandidates', () => {
  it('lists the suggestions first, then search results that are not suggestions', () => {
    expect(
      fixCandidates([{ item: inceptionResult, confidence: 0.82 }], [inceptionResult, duneResult]),
    ).toEqual([{ item: inceptionResult, confidence: 0.82 }, { item: duneResult }]);
  });

  it('shows at most 10 search results', () => {
    const results = Array.from({ length: 12 }, (_, index) => ({
      ...duneResult,
      externalId: `movie:${1000 + index}`,
    }));
    expect(fixCandidates(null, results)).toHaveLength(10);
  });
});

describe('moveIndex', () => {
  it('moves the highlight and keeps it inside the list', () => {
    expect(moveIndex(0, 1, 3)).toBe(1);
    expect(moveIndex(2, 1, 3)).toBe(2);
    expect(moveIndex(0, -1, 3)).toBe(0);
    expect(moveIndex(0, 1, 0)).toBe(-1);
  });
});

describe('initialSearch', () => {
  it('starts with the parsed title, year and kind', () => {
    expect(initialSearch(inception)).toEqual({ title: 'Inception', year: '2010', kind: 'movie' });
    expect(
      initialSearch({
        filePath: 'F:\\Series\\Severance\\Severance.S01E01.mkv',
        parsedTitle: 'Severance',
        parsedYear: null,
      }),
    ).toEqual({ title: 'Severance', year: '', kind: 'tv' });
  });
});

describe('searchYear', () => {
  it('accepts only a four-digit year', () => {
    expect(searchYear('2010')).toBe(2010);
    expect(searchYear('20')).toBeUndefined();
  });
});

describe('confidenceLabel', () => {
  it('shows the confidence as a percentage', () => {
    expect(confidenceLabel(0.92)).toBe('92% match');
  });
});

describe('advanceSession', () => {
  it('moves to the next file not handled yet', () => {
    expect(
      advanceSession({ queue: ['a', 'b', 'c', 'd'], currentId: 'a', done: [] }, ['b']),
    ).toEqual({ queue: ['a', 'b', 'c', 'd'], currentId: 'c', done: ['a', 'b'] });
  });

  it('returns null when no file is left', () => {
    expect(
      advanceSession({ queue: ['a', 'b', 'c'], currentId: 'b', done: ['a'] }, ['c']),
    ).toBeNull();
  });
});

describe('removesCurrentItem', () => {
  it('is true when the scanner added the item and every linked file is fixed', () => {
    const linked = [inception, inception4k];
    expect(
      removesCurrentItem({
        itemSource: 'scanner',
        linked,
        fixedIds: [inception.id, inception4k.id],
      }),
    ).toBe(true);
    expect(removesCurrentItem({ itemSource: 'scanner', linked, fixedIds: [inception.id] })).toBe(
      false,
    );
    expect(
      removesCurrentItem({
        itemSource: 'manual',
        linked,
        fixedIds: [inception.id, inception4k.id],
      }),
    ).toBe(false);
  });
});

describe('fixSummary', () => {
  it('summarizes a fix', () => {
    expect(
      fixSummary(
        'link',
        {
          files: [inception, inception4k],
          removedItemIds: ['4d5e6f70-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
          skipped: 0,
        },
        'Inception',
      ),
    ).toBe('Matched 2 files to Inception · removed 1 wrong item');
    expect(fixSummary('accept', { files: [inception], removedItemIds: [], skipped: 3 })).toBe(
      'Matched 1 file · 3 had no suggestion to accept',
    );
    expect(fixSummary('ignore', { files: [inception], removedItemIds: [], skipped: 0 })).toBe(
      'Ignored 1 file',
    );
    expect(fixSummary('restore', { files: [inception], removedItemIds: [], skipped: 0 })).toBe(
      '1 file sent back to matching',
    );
  });
});
