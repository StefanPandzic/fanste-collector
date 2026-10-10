import { readFileSync, renameSync, writeFileSync } from 'node:fs';

import type { LibraryFolder } from '@fanste/core';

/** The scanner's local state (FC-21), saved to `<userData>/scanner.json`. */
export interface ScannerStore {
  /** `scanned_files.device_id`. Generated once; losing it orphans this device's rows. */
  deviceId: string;
  folders: LibraryFolder[];
}

const MAX_FOLDERS = 100;

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function parseFolder(value: unknown): LibraryFolder | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { path, pathKey, addedAt } = value as Partial<Record<keyof LibraryFolder, unknown>>;
  if (!isText(path, 4096) || !isText(pathKey, 4096) || !isText(addedAt, 64)) return undefined;
  return { path, pathKey, addedAt };
}

/** Validates data read from disk; `undefined` if it isn't a {@link ScannerStore}. */
export function parseScannerStore(value: unknown): ScannerStore | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { deviceId, folders } = value as Partial<Record<keyof ScannerStore, unknown>>;
  if (!isText(deviceId, 100) || !Array.isArray(folders)) return undefined;
  // A bad folder entry drops only that folder, never the device ID.
  const valid = folders.map(parseFolder).filter((folder) => folder !== undefined);
  return { deviceId, folders: valid.slice(0, MAX_FOLDERS) };
}

/**
 * Reads the store. A missing or unreadable file gives a new store with a fresh device ID (from
 * `createId`), so the first launch and a corrupted file both work.
 */
export function readScannerStore(filePath: string, createId: () => string): ScannerStore {
  try {
    const store = parseScannerStore(JSON.parse(readFileSync(filePath, 'utf8')));
    if (store) return store;
  } catch {
    // Missing or not JSON: start over below.
  }
  return { deviceId: createId(), folders: [] };
}

/** Saves the store through a temp file, so a crash mid-write can't lose the device ID. */
export function writeScannerStore(filePath: string, store: ScannerStore): void {
  const temp = `${filePath}.tmp`;
  writeFileSync(temp, JSON.stringify(store));
  renameSync(temp, filePath);
}

/**
 * Adds folders that aren't in the library yet (by path key).
 *
 * @returns The new store and the folders that were added.
 */
export function addLibraryFolders(
  store: ScannerStore,
  folders: readonly Pick<LibraryFolder, 'path' | 'pathKey'>[],
  addedAt: string,
): { store: ScannerStore; added: LibraryFolder[] } {
  const added: LibraryFolder[] = [];
  for (const { path, pathKey } of folders) {
    const exists = [...store.folders, ...added].some((folder) => folder.pathKey === pathKey);
    if (exists || store.folders.length + added.length >= MAX_FOLDERS) continue;
    added.push({ path, pathKey, addedAt });
  }
  return { store: { ...store, folders: [...store.folders, ...added] }, added };
}

/** Removes the folder with this path key (a no-op if it isn't there). */
export function removeLibraryFolder(store: ScannerStore, pathKey: string): ScannerStore {
  return { ...store, folders: store.folders.filter((folder) => folder.pathKey !== pathKey) };
}
