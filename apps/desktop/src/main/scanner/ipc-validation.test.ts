import { describe, expect, it } from 'vitest';

import {
  isProbeAllowed,
  parseFolderPath,
  parseProbePaths,
  parseScanOptions,
  resolveScanFolders,
} from './ipc-validation';

const library = [
  { path: 'E:\\Movies', pathKey: 'e:/movies', addedAt: '2026-10-01T09:00:00.000Z' },
  { path: 'F:\\Series', pathKey: 'f:/series', addedAt: '2026-10-01T09:00:00.000Z' },
];

describe('parseFolderPath', () => {
  it('resolves absolute paths', () => {
    expect(parseFolderPath('E:\\Movies\\Inception (2010)', 'windows')).toBe(
      'E:\\Movies\\Inception (2010)',
    );
    expect(parseFolderPath('E:\\Movies\\..\\Private', 'windows')).toBe('E:\\Private');
    expect(parseFolderPath('/Volumes/Media/Movies/', 'macos')).toBe('/Volumes/Media/Movies');
  });

  it('rejects relative and non-string paths', () => {
    expect(() => parseFolderPath('Movies\\Inception', 'windows')).toThrow(/Invalid folder path/);
    expect(() => parseFolderPath('/Volumes/Media', 'windows')).toThrow(/Invalid folder path/);
    expect(() => parseFolderPath(42, 'linux')).toThrow(/Invalid folder path/);
  });
});

describe('parseScanOptions', () => {
  it('parses the folders and minimum size', () => {
    expect(parseScanOptions(undefined, 'windows')).toEqual({ minFileSizeMb: 50 });
    expect(parseScanOptions({ folders: ['E:\\Movies'], minFileSizeMb: 100 }, 'windows')).toEqual({
      folders: ['E:\\Movies'],
      minFileSizeMb: 100,
    });
  });

  it('rejects invalid options', () => {
    expect(() => parseScanOptions({ minFileSizeMb: -1 }, 'windows')).toThrow(
      /Invalid minimum file size/,
    );
    expect(() => parseScanOptions({ folders: [] }, 'windows')).toThrow(/Invalid scan folders/);
    expect(() => parseScanOptions({ folders: ['Movies'] }, 'windows')).toThrow(
      /Invalid folder path/,
    );
  });
});

describe('resolveScanFolders', () => {
  it('returns the whole library or the requested folders inside it', () => {
    expect(resolveScanFolders(undefined, library, 'windows')).toEqual([
      { path: 'E:\\Movies', pathKey: 'e:/movies' },
      { path: 'F:\\Series', pathKey: 'f:/series' },
    ]);
    expect(resolveScanFolders(['E:\\Movies\\Inception (2010)'], library, 'windows')).toEqual([
      { path: 'E:\\Movies\\Inception (2010)', pathKey: 'e:/movies/inception (2010)' },
    ]);
  });

  it('rejects folders outside the library', () => {
    expect(() => resolveScanFolders(['D:\\Private'], library, 'windows')).toThrow(
      /not in the library/,
    );
    const escaped = parseFolderPath('E:\\Movies\\..\\Private', 'windows');
    expect(() => resolveScanFolders([escaped], library, 'windows')).toThrow(/not in the library/);
  });

  it('drops folders inside another requested folder', () => {
    expect(
      resolveScanFolders(
        ['E:\\Movies\\Inception (2010)', 'E:\\Movies', 'E:\\Movies'],
        library,
        'windows',
      ),
    ).toEqual([{ path: 'E:\\Movies', pathKey: 'e:/movies' }]);
  });
});

describe('parseProbePaths', () => {
  it('resolves a list of absolute paths', () => {
    expect(
      parseProbePaths(['E:\\Movies\\Dune (2021)\\..\\Inception (2010)\\Inception.mkv'], 'windows'),
    ).toEqual(['E:\\Movies\\Inception (2010)\\Inception.mkv']);
  });

  it('rejects an invalid file list', () => {
    expect(() => parseProbePaths('E:\\Movies\\Dune.mkv', 'windows')).toThrow(/Invalid file list/);
    expect(() => parseProbePaths([], 'windows')).toThrow(/Invalid file list/);
    expect(() => parseProbePaths(Array(51).fill('E:\\Movies\\Dune.mkv'), 'windows')).toThrow(
      /Invalid file list/,
    );
    expect(() => parseProbePaths(['Movies\\Dune.mkv'], 'windows')).toThrow(/Invalid folder path/);
  });
});

describe('isProbeAllowed', () => {
  it('allows videos inside a library folder', () => {
    expect(isProbeAllowed('E:\\Movies\\Inception (2010)\\Inception.mkv', library, 'windows')).toBe(
      true,
    );
    expect(isProbeAllowed('F:\\Series\\Severance\\S01E01.mp4', library, 'windows')).toBe(true);
  });

  it('refuses files outside the library, non-videos and library folders', () => {
    expect(isProbeAllowed('D:\\Private\\Dune.mkv', library, 'windows')).toBe(false);
    expect(isProbeAllowed('E:\\Movies\\Inception (2010)\\passwords.txt', library, 'windows')).toBe(
      false,
    );
    expect(isProbeAllowed('E:\\Movies', library, 'windows')).toBe(false);
  });
});
