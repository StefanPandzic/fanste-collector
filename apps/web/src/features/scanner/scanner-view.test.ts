import { describe, expect, it } from 'vitest';

import {
  fileName,
  filesPerFolder,
  filterFiles,
  formatFileSize,
  keysKeptByFolders,
  loadMinSize,
  MIN_SIZE_STORAGE_KEY,
  pageOf,
  parentFolder,
  parsedLabel,
  scanSummary,
  statusCounts,
} from './scanner-view';

import type { ScannedFile } from '@fanste/collection';
import type { LibraryFolder } from '@fanste/core';

const inception: ScannedFile = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  deviceId: '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c',
  pathKey: 'e:/movies/inception (2010)/inception.mkv',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.mkv',
  size: 4_294_967_296,
  modifiedAt: '2026-09-01T18:30:00+00:00',
  parsedTitle: 'Inception',
  parsedYear: 2010,
  matchStatus: 'matched',
  matchConfidence: 0.97,
  collectionItemId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  scannedAt: '2026-10-10T12:00:00.000Z',
  removedAt: null,
  subtitleLanguages: ['en'],
};

const dune: ScannedFile = {
  ...inception,
  id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
  pathKey: 'e:/movies/dune (2021)/dune.mkv',
  filePath: 'E:\\Movies\\Dune (2021)\\Dune.mkv',
  matchStatus: 'pending',
};

const severance: ScannedFile = {
  ...inception,
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  pathKey: 'f:/series/severance/s01e01.mkv',
  filePath: 'F:\\Series\\Severance\\S01E01.mkv',
  matchStatus: 'pending',
};

const files = [inception, dune, severance];

const movies: LibraryFolder = {
  path: 'E:\\Movies',
  pathKey: 'e:/movies',
  addedAt: '2026-10-01T09:00:00.000Z',
};
const series: LibraryFolder = { ...movies, path: 'F:\\Series', pathKey: 'f:/series' };

function storage(value: string | null): Storage {
  return { getItem: (key: string) => (key === MIN_SIZE_STORAGE_KEY ? value : null) } as Storage;
}

describe('fileName / parentFolder', () => {
  it('splits a Windows or POSIX path', () => {
    expect(fileName('E:\\Movies\\Inception (2010)\\Inception.mkv')).toBe('Inception.mkv');
    expect(parentFolder('E:\\Movies\\Inception (2010)\\Inception.mkv')).toBe(
      'E:\\Movies\\Inception (2010)',
    );
    expect(fileName('/Volumes/Media/Dune.mkv')).toBe('Dune.mkv');
    expect(parentFolder('/Volumes/Media/Dune.mkv')).toBe('/Volumes/Media');
  });
});

describe('formatFileSize', () => {
  it('formats bytes with a unit', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(700 * 1024 * 1024)).toBe('700 MB');
    expect(formatFileSize(1.4 * 1024 ** 3)).toBe('1.4 GB');
    expect(formatFileSize(null)).toBe('—');
  });
});

describe('parsedLabel', () => {
  it('shows the parsed title and year', () => {
    expect(parsedLabel(inception)).toBe('Inception (2010)');
    expect(parsedLabel({ parsedTitle: 'Inception', parsedYear: null })).toBe('Inception');
    expect(parsedLabel({ parsedTitle: null, parsedYear: null })).toBe('—');
  });
});

describe('statusCounts', () => {
  it('counts files per status', () => {
    expect(statusCounts(files)).toEqual({
      all: 3,
      pending: 2,
      matched: 1,
      unmatched: 0,
      ignored: 0,
      manual: 0,
    });
  });
});

describe('filterFiles', () => {
  it('filters by status and path search', () => {
    expect(filterFiles(files, 'pending', '')).toEqual([dune, severance]);
    expect(filterFiles(files, 'all', ' severance ')).toEqual([severance]);
    expect(filterFiles(files, 'matched', 'dune')).toEqual([]);
  });
});

describe('pageOf', () => {
  it('returns one page with the page clamped into range', () => {
    expect(pageOf(files, 1, 2)).toEqual({ rows: [severance], page: 1, pageCount: 2 });
    expect(pageOf(files, 5, 2)).toEqual({ rows: [severance], page: 1, pageCount: 2 });
  });
});

describe('filesPerFolder', () => {
  it('counts the files inside each library folder', () => {
    expect(filesPerFolder(files, [movies, series])).toEqual(
      new Map([
        ['e:/movies', 2],
        ['f:/series', 1],
      ]),
    );
  });
});

describe('keysKeptByFolders', () => {
  it('returns the keys of files the remaining folders cover', () => {
    expect(keysKeptByFolders(files, [series])).toEqual(new Set([severance.pathKey]));
  });
});

describe('loadMinSize', () => {
  it('reads a stored option and falls back to the default', () => {
    expect(loadMinSize(storage('300'))).toBe(300);
    expect(loadMinSize(storage('42'))).toBe(50);
    expect(loadMinSize(undefined)).toBe(50);
  });
});

describe('scanSummary', () => {
  it('summarizes a finished scan', () => {
    expect(scanSummary({ found: 120, written: 4, removed: 0 })).toBe(
      'Found 120 videos · 4 new or changed',
    );
    expect(scanSummary({ found: 1, written: 0, removed: 2 })).toBe(
      'Found 1 video · nothing new · 2 gone',
    );
  });
});
