import { DEFAULT_MIN_VIDEO_SIZE_MB, isPathInside } from '@fanste/core';

import type { ScannedFile } from '@fanste/collection';
import type { LibraryFolder, ScanMatchStatus } from '@fanste/core';

/** What the scanner page shows (FC-21). Pure, so it is unit-tested. */

/** Results table rows per page. */
export const RESULTS_PAGE_SIZE = 100;

/** Status filter of the results table: one status, or every file. */
export type StatusFilter = 'all' | ScanMatchStatus;

export const STATUS_LABELS: Record<ScanMatchStatus, string> = {
  pending: 'Waiting for match',
  matched: 'Matched',
  unmatched: 'Needs review',
  ignored: 'Ignored',
  manual: 'Matched by hand',
};

/** The choices of the minimum video size setting, in MB (0 = every video). */
export const MIN_SIZE_OPTIONS_MB: readonly number[] = [0, 10, 50, 100, 300, 700];

/** The last segment of a path, e.g. `Inception.2010.mkv`. Works with `\` and `/`. */
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** The folder a file is in, e.g. `D:\Movies\Inception`. */
export function parentFolder(path: string): string {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return index > 0 ? path.slice(0, index) : path;
}

/** Bytes as `1.4 GB`, `700 MB`, `0 B`. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit >= 3 && value < 10 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** `Inception (2010)`, `Inception`, or `—` before the file has been parsed (FC-22). */
export function parsedLabel(file: Pick<ScannedFile, 'parsedTitle' | 'parsedYear'>): string {
  if (!file.parsedTitle) return '—';
  return file.parsedYear ? `${file.parsedTitle} (${file.parsedYear})` : file.parsedTitle;
}

/** The files still on disk (not marked as removed). */
export function currentFiles(files: readonly ScannedFile[]): ScannedFile[] {
  return files.filter((file) => file.removedAt === null);
}

/** The number of files per status, plus `all`. */
export function statusCounts(files: readonly ScannedFile[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: files.length,
    pending: 0,
    matched: 0,
    unmatched: 0,
    ignored: 0,
    manual: 0,
  };
  for (const file of files) counts[file.matchStatus] += 1;
  return counts;
}

/** The files with the status whose path contains `search` (case-insensitive). */
export function filterFiles(
  files: readonly ScannedFile[],
  status: StatusFilter,
  search: string,
): ScannedFile[] {
  const needle = search.trim().toLowerCase();
  return files.filter(
    (file) =>
      (status === 'all' || file.matchStatus === status) &&
      (!needle || file.filePath.toLowerCase().includes(needle)),
  );
}

/** One page of the results, with the page clamped into range. */
export function pageOf<T>(
  rows: readonly T[],
  page: number,
  size = RESULTS_PAGE_SIZE,
): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  return { rows: rows.slice(current * size, (current + 1) * size), page: current, pageCount };
}

/** The number of current files inside each library folder, by path key. */
export function filesPerFolder(
  files: readonly ScannedFile[],
  folders: readonly LibraryFolder[],
): Map<string, number> {
  return new Map(
    folders.map((folder) => [
      folder.pathKey,
      files.filter((file) => isPathInside(file.pathKey, folder.pathKey)).length,
    ]),
  );
}

/**
 * Path keys of the files the remaining library folders still cover. When a folder is taken out of
 * the library, its files are marked as removed, except these (a folder inside or around another).
 */
export function keysKeptByFolders(
  files: readonly ScannedFile[],
  remaining: readonly LibraryFolder[],
): Set<string> {
  return new Set(
    files
      .filter((file) => remaining.some((folder) => isPathInside(file.pathKey, folder.pathKey)))
      .map((file) => file.pathKey),
  );
}

/** Local storage key of the minimum video size. Per device, like the library itself. */
export const MIN_SIZE_STORAGE_KEY = 'fanste:scanner-min-size-mb';

/** The stored minimum size; the default when storage is unavailable or holds something else. */
export function loadMinSize(storage: Storage | undefined): number {
  try {
    const stored = Number(storage?.getItem(MIN_SIZE_STORAGE_KEY) ?? Number.NaN);
    return MIN_SIZE_OPTIONS_MB.includes(stored) ? stored : DEFAULT_MIN_VIDEO_SIZE_MB;
  } catch {
    return DEFAULT_MIN_VIDEO_SIZE_MB;
  }
}

/** A summary of a finished scan for the toast, e.g. `Found 120 videos · 4 new or changed`. */
export function scanSummary({
  found,
  written,
  removed,
}: {
  found: number;
  written: number;
  removed: number;
}): string {
  const parts = [`Found ${found.toLocaleString()} ${found === 1 ? 'video' : 'videos'}`];
  parts.push(written > 0 ? `${written.toLocaleString()} new or changed` : 'nothing new');
  if (removed > 0) parts.push(`${removed.toLocaleString()} gone`);
  return parts.join(' · ');
}
