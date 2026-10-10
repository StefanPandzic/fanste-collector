import { movieDetailsShape } from '../models/copy-details';
import { parseFields } from '../models/lenient';

import type { ParsedMedia } from './filename-parser';
import type { MovieDetails } from '../models/copy-details';

// What the desktop app reads from a video file's own headers (FC-22), as opposed to its name. Stored
// in `scanned_files.media_info`: `null` until the file is read, `{}` when nothing could be read.

const { fileFormat, resolution, hdr, audioChannels, audioLanguages, subtitleLanguages } =
  movieDetailsShape;

/** The copy-detail fields a file's headers can tell, with the same values as the FC-15 fields. */
export const mediaInfoShape = {
  fileFormat,
  resolution,
  /** `none` when the video track is SDR. */
  hdr,
  /** Of the default (or first) audio track. */
  audioChannels,
  /** Languages of the audio tracks, the default track first. */
  audioLanguages,
  /** Languages of the embedded subtitle tracks. */
  subtitleLanguages,
};

export type MediaInfo = Pick<
  MovieDetails,
  'fileFormat' | 'resolution' | 'hdr' | 'audioChannels' | 'audioLanguages' | 'subtitleLanguages'
>;

/** Reads stored `media_info`, keeping the valid fields. `null` when the file hasn't been read. */
export function parseMediaInfo(value: unknown): MediaInfo | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return parseFields(mediaInfoShape, value);
}

/**
 * The resolution class of a video's frame size (see `RESOLUTIONS`). Either dimension counts, so
 * cropped widescreen (1920×800) is still 1080p and 4:3 HD (1440×1080) is too.
 */
export function resolutionFromDimensions(
  width: number,
  height: number,
): MediaInfo['resolution'] | undefined {
  if (width <= 0 || height <= 0) return undefined;
  if (width >= 3200 || height >= 1800) return '2160p';
  if (width >= 1700 || height >= 1000) return '1080p';
  if (width >= 1200 || height >= 700) return '720p';
  if (height > 480) return '576p';
  return '480p';
}

/**
 * A channel count as a layout, e.g. 6 → `5.1` (see `AUDIO_CHANNELS`).
 *
 * @param hasLfe Whether one channel is the LFE (subwoofer). When it isn't known, 6–8 channels are
 *   taken to have one and fewer channels not.
 */
export function channelLayout(channels: number, hasLfe?: boolean): string | undefined {
  if (!Number.isInteger(channels) || channels < 1 || channels > 24) return undefined;
  const lfe = (hasLfe ?? channels >= 6) && channels > 1 ? 1 : 0;
  return `${channels - lfe}.${lfe}`;
}

/** The FC-15 medium and details of a scanned file. */
export interface ScannedCopyDetails {
  format: 'Digital file';
  details: MovieDetails;
}

/**
 * The copy details of a scanned file (FC-15), for the matcher (FC-23) to add it with: `format:
 * 'Digital file'` and the file's container, resolution, HDR, audio channels and languages. What the
 * file's headers say (`mediaInfo`) wins over its name (`parsed`), which only fills the gaps, e.g.
 * `2160p` + `DV` in the name → 2160p, Dolby Vision.
 *
 * @param sidecarSubtitleLanguages Languages of the subtitle files next to the video (FC-21), listed
 *   before the embedded ones.
 */
export function toCopyDetails(
  parsed: ParsedMedia,
  mediaInfo?: MediaInfo | null,
  sidecarSubtitleLanguages: readonly string[] = [],
): ScannedCopyDetails {
  const subtitles = [...sidecarSubtitleLanguages, ...(mediaInfo?.subtitleLanguages ?? [])];
  const details = parseFields(movieDetailsShape, {
    fileFormat: mediaInfo?.fileFormat ?? parsed.fileFormat,
    resolution: mediaInfo?.resolution ?? parsed.resolution,
    hdr: mediaInfo?.hdr ?? parsed.hdr,
    audioChannels: mediaInfo?.audioChannels ?? parsed.audioChannels,
    audioLanguages: mediaInfo?.audioLanguages,
    subtitleLanguages: subtitles.length > 0 ? subtitles : undefined,
  });
  return { format: 'Digital file', details };
}
