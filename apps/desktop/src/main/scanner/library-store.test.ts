import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addLibraryFolders,
  parseScannerStore,
  readScannerStore,
  removeLibraryFolder,
  writeScannerStore,
} from './library-store';

const deviceId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const movies = { path: 'E:\\Movies', pathKey: 'e:/movies', addedAt: '2026-10-01T09:00:00.000Z' };
const series = { path: 'F:\\Series', pathKey: 'f:/series' };
const store = { deviceId, folders: [movies] };

describe('parseScannerStore', () => {
  it('accepts a valid store and drops bad folders', () => {
    expect(parseScannerStore(store)).toEqual(store);
    expect(parseScannerStore({ deviceId, folders: [movies, { path: 'E:\\Broken' }] })).toEqual(
      store,
    );
  });

  it('rejects malformed data', () => {
    expect(parseScannerStore(null)).toBeUndefined();
    expect(parseScannerStore({ folders: [movies] })).toBeUndefined();
    expect(parseScannerStore({ deviceId, folders: 'E:\\Movies' })).toBeUndefined();
  });
});

describe('readScannerStore / writeScannerStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fanste-scanner-store-'));
    file = path.join(dir, 'scanner.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips the store', () => {
    writeScannerStore(file, store);
    expect(readScannerStore(file, () => 'unused')).toEqual(store);
  });

  it('starts a new store for a missing or corrupt file', () => {
    const fresh = { deviceId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', folders: [] };
    expect(readScannerStore(file, () => fresh.deviceId)).toEqual(fresh);
    writeFileSync(file, '{ not json');
    expect(readScannerStore(file, () => fresh.deviceId)).toEqual(fresh);
  });
});

describe('addLibraryFolders', () => {
  it('adds only folders that are not in the library yet', () => {
    const addedAt = '2026-10-10T12:00:00.000Z';
    const result = addLibraryFolders(store, [movies, series], addedAt);
    expect(result.added).toEqual([{ ...series, addedAt }]);
    expect(result.store).toEqual({ deviceId, folders: [movies, { ...series, addedAt }] });
  });
});

describe('removeLibraryFolder', () => {
  it('removes the folder with the path key', () => {
    expect(removeLibraryFolder(store, 'e:/movies')).toEqual({ deviceId, folders: [] });
    expect(removeLibraryFolder(store, 'f:/series')).toEqual(store);
  });
});
