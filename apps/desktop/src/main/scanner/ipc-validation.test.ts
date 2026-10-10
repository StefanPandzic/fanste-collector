import { describe, expect, it } from 'vitest';

import { parseFolderPath, parseScanOptions, resolveScanFolders } from './ipc-validation';

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
