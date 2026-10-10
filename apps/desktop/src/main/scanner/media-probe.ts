import { channelLayout, resolutionFromDimensions, toLanguageCode } from '@fanste/core';

import type { MediaInfo } from '@fanste/core';
import type { AudioTrack, MediaInfoResult, TextTrack, Track, VideoTrack } from 'mediainfo.js';

/**
 * Maps what MediaInfo read from a video file's headers to the copy-detail fields (FC-22). Pure, so
 * it is unit-tested with result objects; `probe-worker.ts` does the reading.
 */

/** MediaInfo container names → the file formats they can be (see `VIDEO_FILE_FORMATS`). */
const CONTAINERS: Readonly<Record<string, readonly string[]>> = {
  Matroska: ['MKV'],
  WebM: ['WebM'],
  'MPEG-4': ['MP4', 'M4V', 'MOV'],
  QuickTime: ['MOV'],
  AVI: ['AVI'],
  'Windows Media': ['WMV'],
  BDAV: ['M2TS', 'TS'],
  'MPEG-TS': ['TS', 'M2TS'],
  'MPEG-PS': ['MPG', 'VOB'],
};

function isVideo(track: Track): track is VideoTrack {
  return track['@type'] === 'Video';
}

function isAudio(track: Track): track is AudioTrack {
  return track['@type'] === 'Audio';
}

function isText(track: Track): track is TextTrack {
  return track['@type'] === 'Text';
}

/** The default tracks first, in file order otherwise. */
function defaultFirst<T extends { readonly Default?: string }>(tracks: readonly T[]): T[] {
  return tracks.toSorted((a, b) => Number(b.Default === 'Yes') - Number(a.Default === 'Yes'));
}

/**
 * The file format of a container. A container that can be several formats (MPEG-4 is MP4, M4V or
 * MOV) keeps the one the extension names.
 *
 * @param extension The file's extension, e.g. `.m4v`.
 */
function fileFormatOf(
  format: string | undefined,
  profile: string | undefined,
  extension: string,
): string | undefined {
  const candidates = format ? CONTAINERS[format] : undefined;
  if (!candidates) return undefined;
  const named = extension.replace(/^\./, '').toUpperCase();
  const match = candidates.find((candidate) => candidate.toUpperCase() === named);
  if (match) return match;
  return profile?.includes('QuickTime') ? 'MOV' : candidates[0];
}

/** HDR format of a video track, or `none` for SDR (see `HDR_FORMATS`). */
function hdrOf(video: VideoTrack): string | undefined {
  const hdr = `${video.HDR_Format ?? ''} ${video.HDR_Format_Compatibility ?? ''}`;
  if (hdr.includes('Dolby Vision')) return 'Dolby Vision';
  if (hdr.includes('2094 App 4') || hdr.includes('HDR10+')) return 'HDR10+';
  if (hdr.includes('2086') || hdr.includes('HDR10')) return 'HDR10';
  const transfer = video.transfer_characteristics ?? '';
  if (transfer.includes('PQ') || transfer.includes('2084')) return 'HDR10';
  // HLG has no copy-detail value; it isn't SDR either.
  if (transfer.includes('HLG')) return undefined;
  return 'none';
}

/** The languages of tracks as the app's codes, unique, in order. */
function languagesOf(tracks: readonly (AudioTrack | TextTrack)[]): string[] | undefined {
  const codes = tracks.flatMap((track) => {
    const code = track.Language ? toLanguageCode(track.Language) : undefined;
    return code ? [code] : [];
  });
  return codes.length > 0 ? [...new Set(codes)] : undefined;
}

/**
 * The media info of a MediaInfo result: the container, the main video track's resolution and HDR
 * format, the default audio track's channels, and the audio and subtitle languages. Fields MediaInfo
 * didn't report are left out, so `{}` means nothing could be told.
 *
 * @param extension The file's extension, e.g. `.mkv`.
 */
export function toMediaInfo(result: MediaInfoResult, extension: string): MediaInfo {
  const tracks = result.media?.track ?? [];
  const general = tracks.find((track) => track['@type'] === 'General');
  const [video] = defaultFirst(tracks.filter(isVideo));
  const audio = defaultFirst(tracks.filter(isAudio));
  const text = tracks.filter(isText);

  const info: MediaInfo = {};
  const fileFormat = fileFormatOf(general?.Format, general?.Format_Profile, extension);
  if (fileFormat) info.fileFormat = fileFormat;
  if (video) {
    const resolution = resolutionFromDimensions(video.Width ?? 0, video.Height ?? 0);
    if (resolution) info.resolution = resolution;
    const hdr = hdrOf(video);
    if (hdr) info.hdr = hdr;
  }
  const mainAudio = audio[0];
  if (mainAudio?.Channels) {
    const hasLfe = mainAudio.ChannelLayout ? mainAudio.ChannelLayout.includes('LFE') : undefined;
    const channels = channelLayout(mainAudio.Channels, hasLfe);
    if (channels) info.audioChannels = channels;
  }
  const audioLanguages = languagesOf(audio);
  if (audioLanguages) info.audioLanguages = audioLanguages;
  const subtitleLanguages = languagesOf(text);
  if (subtitleLanguages) info.subtitleLanguages = subtitleLanguages;
  return info;
}
