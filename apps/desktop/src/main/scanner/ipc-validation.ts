import path from 'node:path';

import {
  DEFAULT_MIN_VIDEO_SIZE_MB,
  isPathInside,
  MAX_MIN_VIDEO_SIZE_MB,
  toPathKey,
} from '@fanste/core';

import type { DesktopOs, LibraryFolder, ScannedFolder } from '@fanste/core';

/**
 * Validation of the scanner's IPC arguments (FC-21). They come from the renderer, which is treated
 * as a remote web page, so every path must be absolute and inside a folder the user picked in the
 * native dialog. Pure (`node:path` only), so it is unit-tested.
 */

const MAX_PATH_LENGTH = 4096;
const MAX_FOLDERS_PER_SCAN = 100;

export interface ParsedScanOptions {
  folders?: string[];
  minFileSizeMb: number;
}

function pathApi(os: DesktopOs): path.PlatformPath {
  return os === 'windows' ? path.win32 : path.posix;
}

/** `true` for `C:\…` / `\\server\share\…` on Windows and `/…` elsewhere. */
function isAbsolutePath(value: string, os: DesktopOs): boolean {
  return os === 'windows' ? /^([a-z]:[\\/]|\\\\[^\\])/i.test(value) : value.startsWith('/');
}

/**
 * An absolute path from the renderer, resolved (so `..` can't climb out of a library folder).
 *
 * @throws If it isn't a string, isn't absolute, is too long or contains a NUL character.
 */
export function parseFolderPath(value: unknown, os: DesktopOs): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    value.includes('\0') ||
    !isAbsolutePath(value, os)
  ) {
    throw new Error('Invalid folder path');
  }
  return pathApi(os).resolve(value);
}

/**
 * The `startScan` options from the renderer.
 *
 * @throws If they aren't a valid {@link ParsedScanOptions} shape.
 */
export function parseScanOptions(value: unknown, os: DesktopOs): ParsedScanOptions {
  if (value === undefined) return { minFileSizeMb: DEFAULT_MIN_VIDEO_SIZE_MB };
  if (typeof value !== 'object' || value === null) throw new Error('Invalid scan options');
  const { folders, minFileSizeMb } = value as Record<string, unknown>;

  let size = DEFAULT_MIN_VIDEO_SIZE_MB;
  if (minFileSizeMb !== undefined) {
    if (
      typeof minFileSizeMb !== 'number' ||
      !Number.isFinite(minFileSizeMb) ||
      minFileSizeMb < 0 ||
      minFileSizeMb > MAX_MIN_VIDEO_SIZE_MB
    ) {
      throw new Error('Invalid minimum file size');
    }
    size = minFileSizeMb;
  }

  if (folders === undefined) return { minFileSizeMb: size };
  if (!Array.isArray(folders) || folders.length === 0 || folders.length > MAX_FOLDERS_PER_SCAN) {
    throw new Error('Invalid scan folders');
  }
  return { folders: folders.map((folder) => parseFolderPath(folder, os)), minFileSizeMb: size };
}

/**
 * The folders to walk: the whole library, or the requested folders, each of which must be a library
 * folder or inside one. A folder inside another one of the list is dropped, so no file is reported
 * twice.
 *
 * @param requested Resolved paths (see {@link parseFolderPath}); `undefined` for the whole library.
 * @throws If a requested folder isn't inside the library.
 */
export function resolveScanFolders(
  requested: readonly string[] | undefined,
  library: readonly LibraryFolder[],
  os: DesktopOs,
): ScannedFolder[] {
  const folders: ScannedFolder[] = requested
    ? requested.map((folderPath) => {
        const pathKey = toPathKey(folderPath, os);
        if (!library.some((root) => isPathInside(pathKey, root.pathKey))) {
          throw new Error('The folder is not in the library');
        }
        return { path: folderPath, pathKey };
      })
    : library.map(({ path: folderPath, pathKey }) => ({ path: folderPath, pathKey }));

  return folders.filter(
    (folder, index) =>
      !folders.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          isPathInside(folder.pathKey, other.pathKey) &&
          // Of two equal folders, keep the first.
          (folder.pathKey !== other.pathKey || otherIndex < index),
      ),
  );
}
