import { parseMediaFilename } from './filename-parser';
import { isPathInside } from './paths';

import type { ScanMatchStatus, ScannedFileInfo } from './types';

/** What a re-scan needs to know about a file already in `scanned_files` (FC-21). */
export interface KnownScannedFile {
  readonly id: string;
  readonly pathKey: string;
  readonly size: number | null;
  /** ISO 8601, as stored. */
  readonly modifiedAt: string | null;
  readonly removedAt: string | null;
  readonly matchStatus: ScanMatchStatus;
  readonly subtitleLanguages: readonly string[];
  /** The filename parser's title and year as stored (FC-22). */
  readonly parsedTitle: string | null;
  readonly parsedYear: number | null;
}

/** A row to write for a found file. */
export interface ScannedFileUpsert {
  readonly pathKey: string;
  readonly filePath: string;
  readonly size: number;
  readonly modifiedAt: string;
  readonly subtitleLanguages: readonly string[];
  /** From `parseMediaFilename` (FC-22). */
  readonly parsedTitle: string | null;
  readonly parsedYear: number | null;
  /** The container from the file name, e.g. `MKV` (`scanned_files.parsed_format`). */
  readonly parsedFormat: string | null;
  /**
   * `true` for a new file and a file whose content changed: its media info (FC-22) is cleared, so
   * the desktop app reads the file again.
   */
  readonly resetMediaInfo: boolean;
  /**
   * `true` only for a new file, which starts as `pending`. A known file keeps its match status and
   * item link even when its content changed: `unmatched` must stay so (the FC-05 unlink trigger sets
   * it so the matcher doesn't re-add an item the user deleted), and so must the user's choices. The
   * matcher (FC-23) can compare `scanned_at` with its own run to look at changed files again.
   */
  readonly resetMatch: boolean;
}

function sameTime(a: string | null, b: string): boolean {
  // The database returns `+00:00` where the scanner sends `Z`, so compare the instants.
  return a !== null && Date.parse(a) === Date.parse(b);
}

function sameLanguages(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code) => b.includes(code));
}

/**
 * The rows to write for a batch of found files: new files, changed files, files that are back after
 * being removed, files whose subtitles changed and files the filename parser now reads differently
 * (FC-22: rows written before it, or by an older parser). Unchanged files are skipped, which is what
 * makes a re-scan incremental.
 *
 * @param known The device's files in `scanned_files`, by `pathKey`.
 */
export function planScannedFileUpserts(
  known: ReadonlyMap<string, KnownScannedFile>,
  found: readonly ScannedFileInfo[],
): ScannedFileUpsert[] {
  const upserts: ScannedFileUpsert[] = [];
  // One row per key: a bulk upsert fails if it touches the same row twice.
  const planned = new Set<string>();
  for (const file of found) {
    if (planned.has(file.pathKey)) continue;
    planned.add(file.pathKey);
    const row = known.get(file.pathKey);
    const parsed = parseMediaFilename(file.path);
    const parsedYear = parsed.year ?? null;
    const contentChanged =
      !row || row.size !== file.size || !sameTime(row.modifiedAt, file.modifiedAt);
    if (
      row &&
      !contentChanged &&
      row.removedAt === null &&
      sameLanguages(row.subtitleLanguages, file.subtitleLanguages) &&
      row.parsedTitle === parsed.title &&
      row.parsedYear === parsedYear
    ) {
      continue;
    }
    upserts.push({
      pathKey: file.pathKey,
      filePath: file.path,
      size: file.size,
      modifiedAt: file.modifiedAt,
      subtitleLanguages: file.subtitleLanguages,
      parsedTitle: parsed.title,
      parsedYear,
      parsedFormat: parsed.fileFormat ?? null,
      resetMediaInfo: contentChanged,
      resetMatch: !row,
    });
  }
  return upserts;
}

/**
 * IDs of the known files that are gone: not removed yet, inside one of `completedRootKeys`, and not
 * found by the scan. Pass only the library folders whose scan finished, so a cancelled scan or an
 * unplugged drive never marks files as removed.
 *
 * @param seenKeys `pathKey`s of every file the scan found.
 */
export function findRemovedFiles(
  known: Iterable<KnownScannedFile>,
  seenKeys: ReadonlySet<string>,
  completedRootKeys: readonly string[],
): string[] {
  const removed: string[] = [];
  for (const row of known) {
    if (row.removedAt !== null || seenKeys.has(row.pathKey)) continue;
    if (completedRootKeys.some((root) => isPathInside(row.pathKey, root))) removed.push(row.id);
  }
  return removed;
}
