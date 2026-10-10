import { describe, expect, it } from 'vitest';

import { findRemovedFiles, planScannedFileUpserts } from './incremental';

import type { KnownScannedFile } from './incremental';
import type { ScannedFileInfo } from './types';

const found: ScannedFileInfo = {
  path: 'E:\\Movies\\Inception (2010)\\Inception.mkv',
  pathKey: 'e:/movies/inception (2010)/inception.mkv',
  size: 4_294_967_296,
  modifiedAt: '2026-09-01T18:30:00.000Z',
  subtitleLanguages: ['en'],
};

const known: KnownScannedFile = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  pathKey: found.pathKey,
  size: found.size,
  modifiedAt: '2026-09-01T18:30:00+00:00',
  removedAt: null,
  matchStatus: 'matched',
  subtitleLanguages: ['en'],
  parsedTitle: 'Inception',
  parsedYear: 2010,
};

function plan(row: KnownScannedFile | undefined, file: ScannedFileInfo = found) {
  return planScannedFileUpserts(new Map(row ? [[row.pathKey, row]] : []), [file]);
}

describe('planScannedFileUpserts', () => {
  it('writes a new file and skips an unchanged one', () => {
    expect(plan(undefined)).toEqual([
      {
        pathKey: found.pathKey,
        filePath: found.path,
        size: found.size,
        modifiedAt: found.modifiedAt,
        subtitleLanguages: ['en'],
        parsedTitle: 'Inception',
        parsedYear: 2010,
        parsedFormat: 'MKV',
        resetMediaInfo: true,
        resetMatch: true,
      },
    ]);
    expect(plan(known)).toEqual([]);
  });

  it('writes a changed, returning or re-subtitled file but keeps its match', () => {
    expect(plan(known, { ...found, size: 5_000_000_000 })).toEqual([
      expect.objectContaining({ size: 5_000_000_000, resetMatch: false, resetMediaInfo: true }),
    ]);
    expect(plan({ ...known, removedAt: '2026-09-20T10:00:00Z' })).toEqual([
      expect.objectContaining({ resetMatch: false, resetMediaInfo: false }),
    ]);
    expect(plan(known, { ...found, subtitleLanguages: ['en', 'sr'] })).toEqual([
      expect.objectContaining({ subtitleLanguages: ['en', 'sr'], resetMatch: false }),
    ]);
  });

  it('rewrites an unchanged file the parser now reads differently', () => {
    expect(plan({ ...known, parsedTitle: null, parsedYear: null })).toEqual([
      expect.objectContaining({
        parsedTitle: 'Inception',
        parsedYear: 2010,
        resetMatch: false,
        resetMediaInfo: false,
      }),
    ]);
  });

  it('keeps an unmatched or ignored status when the file changes', () => {
    expect(
      plan({ ...known, matchStatus: 'ignored' }, { ...found, modifiedAt: '2026-10-01T09:00:00Z' }),
    ).toEqual([expect.objectContaining({ resetMatch: false })]);
    expect(plan({ ...known, matchStatus: 'unmatched' }, { ...found, size: 1 })).toEqual([
      expect.objectContaining({ resetMatch: false }),
    ]);
  });
});

describe('findRemovedFiles', () => {
  const dune: KnownScannedFile = {
    ...known,
    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    pathKey: 'e:/movies/dune (2021)/dune.mkv',
  };
  const series: KnownScannedFile = {
    ...known,
    id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
    pathKey: 'f:/series/severance/s01e01.mkv',
  };

  it('returns files missing from a completed folder', () => {
    expect(
      findRemovedFiles([known, dune, series], new Set([known.pathKey]), ['e:/movies']),
    ).toEqual([dune.id]);
  });

  it('skips files already removed', () => {
    expect(
      findRemovedFiles([{ ...dune, removedAt: '2026-09-20T10:00:00Z' }], new Set(), ['e:/movies']),
    ).toEqual([]);
  });
});
