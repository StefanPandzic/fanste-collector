import { matchQueryOf } from './match-plan';
import { isPathInside } from './paths';

import type { ScanMatchStatus } from './types';
import type { ItemRef, MatchCandidate } from '../gateway/requests';

// Which files a "Fix Match" choice applies to (FC-24). Pure, so the scanner page and the item page
// share it.

/** What the Fix Match choices need of a `scanned_files` row. */
export interface FixableFile {
  readonly id: string;
  /** Path keys only identify a file on its own device. */
  readonly deviceId: string;
  readonly filePath: string;
  /** `toPathKey` of the path: `/` separators. */
  readonly pathKey: string;
  readonly matchStatus: ScanMatchStatus;
  readonly collectionItemId: string | null;
  readonly removedAt: string | null;
  readonly matchCandidates: readonly MatchCandidate[] | null;
}

/**
 * The files a fix of `file` applies to: `file` first, then the device's other current, not ignored
 * files that the matcher would have matched with it (same `matchQueryOf` key) and that are linked to
 * the same item (or, like `file`, to none). So fixing one episode of a wrongly matched show fixes the
 * show. A file without a parsed title is fixed alone.
 */
export function fixGroup<F extends FixableFile>(file: F, files: readonly F[]): F[] {
  const key = matchQueryOf(file.filePath)?.key;
  if (key === undefined) return [file];
  const others = files.filter(
    (other) =>
      other.id !== file.id &&
      other.deviceId === file.deviceId &&
      other.removedAt === null &&
      other.matchStatus !== 'ignored' &&
      other.collectionItemId === file.collectionItemId &&
      matchQueryOf(other.filePath)?.key === key,
  );
  return [file, ...others];
}

/** The folder a path key is in, e.g. `e:/movies/inception (2010)`. */
export function folderKeyOf(pathKey: string): string {
  const index = pathKey.lastIndexOf('/');
  if (index <= 0) return pathKey;
  // Keep the root of a drive (`e:/`).
  return /^[a-z]:$/.test(pathKey.slice(0, index))
    ? pathKey.slice(0, index + 1)
    : pathKey.slice(0, index);
}

/** The current files of a device in the folder (`folderKey`, a path key) or in folders inside it. */
export function filesInFolder<F extends FixableFile>(
  deviceId: string,
  folderKey: string,
  files: readonly F[],
): F[] {
  return files.filter(
    (file) =>
      file.deviceId === deviceId &&
      file.removedAt === null &&
      isPathInside(file.pathKey, folderKey),
  );
}

/** Files that take the same suggestion. */
export interface SuggestionGroup<F extends FixableFile> {
  ref: ItemRef;
  candidate: MatchCandidate;
  files: F[];
}

/**
 * The files grouped by their best stored candidate ("Accept top suggestion"), in the order the files
 * come. Files without a candidate come back in `skipped`.
 */
export function topSuggestionGroups<F extends FixableFile>(
  files: readonly F[],
): { groups: SuggestionGroup<F>[]; skipped: F[] } {
  const groups = new Map<string, SuggestionGroup<F>>();
  const skipped: F[] = [];
  for (const file of files) {
    const candidate = file.matchCandidates?.[0];
    if (!candidate || candidate.item.provider === 'custom') {
      skipped.push(file);
      continue;
    }
    const ref: ItemRef = {
      provider: candidate.item.provider,
      externalId: candidate.item.externalId,
    };
    const key = `${ref.provider}:${ref.externalId}`;
    const group = groups.get(key);
    if (group) group.files.push(file);
    else groups.set(key, { ref, candidate, files: [file] });
  }
  return { groups: [...groups.values()], skipped };
}
