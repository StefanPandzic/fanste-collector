import { headerDetails, versionsByQuality } from './file-details';
import { parseMediaFilename } from './filename-parser';
import { normalizeTitle } from './match-scoring';
import { MAX_SEARCH_QUERY_LENGTH } from '../gateway/requests';
import { parseDetails } from '../models/copy-details';
import { prefillDetails } from '../models/prefill';

import type { FileDetails } from './file-details';
import type { ParsedMedia } from './filename-parser';
import type { MediaInfo } from './media-info';
import type { MatchQuery } from '../gateway/requests';
import type { AddItemInput } from '../models/collection-input';
import type { TvSeasonDetails } from '../models/copy-details';
import type { NormalizedItem } from '../models/normalized-item';

// Turning scanned files into TMDB queries and matched files into collection copies (FC-23). Pure, so
// the background matcher in `@fanste/collection` stays a thin loop around it.

/** What the matcher needs of a `scanned_files` row. */
export interface MatchableFile {
  readonly id: string;
  /** The real path, parsed again here (season and episode aren't stored). */
  readonly filePath: string;
  readonly mediaInfo: MediaInfo | null;
  readonly subtitleLanguages: readonly string[];
}

export interface ParsedFile<F extends MatchableFile = MatchableFile> {
  file: F;
  parsed: ParsedMedia;
}

/** Files that make one TMDB query: the same kind, title and year (e.g. a show's episodes). */
export interface MatchGroup<F extends MatchableFile = MatchableFile> {
  query: MatchQuery;
  files: ParsedFile<F>[];
}

/** The medium of every copy the scanner adds. */
export const SCANNED_FORMAT = 'Digital file';

/**
 * Groups files by the query that would match them, in the order the files come. Files the parser
 * found no title in can't be matched and come back in `unparsed`. Files of `unknown` kind are
 * searched as movies.
 */
export function groupForMatching<F extends MatchableFile>(
  files: readonly F[],
): { groups: MatchGroup<F>[]; unparsed: F[] } {
  const groups = new Map<string, MatchGroup<F>>();
  const unparsed: F[] = [];
  for (const file of files) {
    const parsed = parseMediaFilename(file.filePath);
    const title = parsed.title?.trim().slice(0, MAX_SEARCH_QUERY_LENGTH).trim();
    if (!title || normalizeTitle(title) === '') {
      unparsed.push(file);
      continue;
    }
    const kind = parsed.kind === 'tv' ? 'tv' : 'movie';
    const key = [kind, normalizeTitle(title), parsed.year ?? ''].join('\u0000');
    const group = groups.get(key);
    if (group) group.files.push({ file, parsed });
    else
      groups.set(key, {
        query: { title, kind, ...(parsed.year !== undefined ? { year: parsed.year } : {}) },
        files: [{ file, parsed }],
      });
  }
  return { groups: [...groups.values()], unparsed };
}

/**
 * The details of the copy that `files` (all matched to `item`) make: the best version's container,
 * resolution, HDR, audio and subtitles (several versions of a movie are one copy), the provider's
 * original language when the file doesn't name one, and for a show the scanned episodes as owned
 * seasons.
 */
export function scannedCopyDetails(
  item: NormalizedItem,
  files: readonly ParsedFile[],
): Record<string, unknown> {
  const [best] = versionsByQuality(files);
  const episodes = files.flatMap(({ parsed }) =>
    parsed.season !== undefined && parsed.episode !== undefined
      ? [{ seasonNumber: parsed.season, episodeNumber: parsed.episode }]
      : [],
  );
  const prefill = prefillDetails(item.category, item, { scan: { episodes } });
  return parseDetails(item.category, { ...prefill.details, ...best?.details });
}

/**
 * The values among `written` (details the scanner writes for `files`) that came from the best
 * version's own headers, to record in `collection_items.file_details` (see `headerDetails`).
 */
export function scannedFileDetails(
  files: readonly ParsedFile[],
  written: Readonly<Record<string, unknown>>,
): FileDetails {
  const [best] = versionsByQuality(files);
  return headerDetails(written, best?.file.file.mediaInfo ?? null);
}

/** A new copy for files matched to `item`: owned, as a `Digital file`, added by the scanner. */
export function scannedCopyInput(item: NormalizedItem, files: readonly ParsedFile[]): AddItemInput {
  if (item.provider === 'custom') throw new Error('Scanned files only match provider items.');
  return {
    category: item.category,
    provider: item.provider,
    externalId: item.externalId,
    format: SCANNED_FORMAT,
    ownership: 'owned',
    details: scannedCopyDetails(item, files),
    source: 'scanner',
  };
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

/** The owned seasons of both lists: episodes are added, nothing is removed. */
export function mergeSeasons(
  current: readonly TvSeasonDetails[],
  scanned: readonly TvSeasonDetails[],
): TvSeasonDetails[] {
  const merged = new Map(current.map((season) => [season.seasonNumber, season]));
  for (const season of scanned) {
    const owned = merged.get(season.seasonNumber);
    if (!owned) merged.set(season.seasonNumber, season);
    else if (owned.episodesOwned !== 'all') {
      const episodesOwned =
        season.episodesOwned === 'all'
          ? 'all'
          : [...new Set([...owned.episodesOwned, ...season.episodesOwned])].sort((a, b) => a - b);
      merged.set(season.seasonNumber, { ...owned, episodesOwned });
    }
  }
  return [...merged.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/**
 * The changes that bring newly scanned details into an existing copy without overwriting what the
 * user set: only empty fields are filled, and a show's newly found episodes are added to its owned
 * seasons. Empty when there is nothing to change.
 */
export function fillEmptyDetails(
  category: NormalizedItem['category'],
  current: unknown,
  scanned: Record<string, unknown>,
): Record<string, unknown> {
  const stored: Record<string, unknown> = parseDetails(category, current);
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(scanned)) {
    if (field === 'seasons' || isEmpty(value)) continue;
    if (isEmpty(stored[field])) patch[field] = value;
  }
  if (category === 'tv' && Array.isArray(scanned.seasons)) {
    const owned = (stored.seasons ?? []) as TvSeasonDetails[];
    const seasons = mergeSeasons(owned, scanned.seasons as TvSeasonDetails[]);
    if (JSON.stringify(seasons) !== JSON.stringify(owned)) patch.seasons = seasons;
  }
  return patch;
}
