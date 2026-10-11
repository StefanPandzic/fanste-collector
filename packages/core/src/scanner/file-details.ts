import { mediaInfoShape, toCopyDetails } from './media-info';
import { parseFields } from '../models/lenient';

import type { MatchableFile, ParsedFile } from './match-plan';
import type { MediaInfo } from './media-info';
import type { MovieDetails } from '../models/copy-details';

// Which copy details came from the video file itself (FC-23). When the scanner adds or fills a copy,
// it records the values it took from the file's own headers in `collection_items.file_details`; the
// item page marks a detail that still has that value "from file", and "edited" once the user changes
// it. Values guessed from the file name aren't recorded.

/** The copy-detail fields a file's headers can tell (the fields of `MediaInfo`). */
export const FILE_DETAIL_FIELDS = Object.keys(mediaInfoShape) as readonly (keyof MediaInfo)[];
export type FileDetailField = keyof MediaInfo;

/** What the scanner recorded in `file_details`: the header values it wrote, per field. */
export type FileDetails = MediaInfo;

/** Reads stored `file_details`, keeping the valid fields. */
export function parseFileDetails(value: unknown): FileDetails {
  return parseFields(mediaInfoShape, value);
}

const RESOLUTION_RANK = ['2160p', '1080p', '720p', '576p', '480p'];

function resolutionRank(resolution: string | undefined): number {
  const rank = resolution === undefined ? -1 : RESOLUTION_RANK.indexOf(resolution);
  return rank === -1 ? RESOLUTION_RANK.length : rank;
}

/** The details of each file (`toCopyDetails`), best version (highest resolution) first. */
export function versionsByQuality<F extends MatchableFile>(
  files: readonly ParsedFile<F>[],
): { file: ParsedFile<F>; details: MovieDetails }[] {
  return files
    .map((entry) => ({
      file: entry,
      details: toCopyDetails(entry.parsed, entry.file.mediaInfo, entry.file.subtitleLanguages)
        .details,
    }))
    .sort((a, b) => resolutionRank(a.details.resolution) - resolutionRank(b.details.resolution));
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * The values among `written` (details the scanner writes) that are exactly what the file's headers
 * say, to record in `file_details`. A value the name filled in, or one mixed with sidecar subtitle
 * files, isn't recorded.
 */
export function headerDetails(
  written: Readonly<Record<string, unknown>>,
  mediaInfo: MediaInfo | null,
): FileDetails {
  if (!mediaInfo) return {};
  const recorded: Record<string, unknown> = {};
  for (const field of FILE_DETAIL_FIELDS) {
    const value = mediaInfo[field];
    if (value !== undefined && same(written[field], value)) recorded[field] = value;
  }
  return recorded;
}

/**
 * How a stored detail relates to the value recorded from the file: `file` while it is the same,
 * `edited` once the user changed or cleared it, `undefined` when nothing was recorded.
 */
export function fileDetailOrigin(
  stored: unknown,
  recorded: unknown,
): 'file' | 'edited' | undefined {
  if (recorded === undefined) return undefined;
  return same(stored, recorded) ? 'file' : 'edited';
}
