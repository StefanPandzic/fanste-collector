import { z } from 'zod';

import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './normalized-item';

// Category-specific `NormalizedItem.extra` fields. `extra` is a loose record, so read it through the
// category's parser: it returns `undefined` when the data doesn't match, instead of throwing.

const text = z.string().trim().min(1);
const count = z.int().min(0);
/** IMDb title ID, e.g. `tt1375666`. */
const imdbId = z.string().regex(/^tt\d+$/);
/** ISO 639-1 code of the original language, e.g. `en`. Suggested as the main audio (FC-15). */
const languageCode = z.string().regex(/^[a-z]{2}$/);

export const movieExtraSchema = z.object({
  runtimeMinutes: count.optional(),
  imdbId: imdbId.optional(),
  /** Title in the original language, when it differs from `title`. */
  originalTitle: text.optional(),
  tagline: text.optional(),
  originalLanguage: languageCode.optional(),
});

export type MovieExtra = z.output<typeof movieExtraSchema>;

export const tvSeasonSchema = z.object({
  /** `0` is TMDB's "Specials" season. */
  seasonNumber: count,
  name: text.optional(),
  episodeCount: count.optional(),
  airYear: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
});

export type TvSeason = z.output<typeof tvSeasonSchema>;

export const tvExtraSchema = z.object({
  imdbId: imdbId.optional(),
  originalTitle: text.optional(),
  originalLanguage: languageCode.optional(),
  /** Provider status, e.g. `Returning Series`, `Ended`, `Canceled`. */
  status: text.optional(),
  seasonCount: count.optional(),
  episodeCount: count.optional(),
  episodeRuntimeMinutes: count.optional(),
  networks: z.array(text).optional(),
  /** Offered as the `seasons` choices of the copy details (FC-15, `prefillDetails`). */
  seasons: z.array(tvSeasonSchema).optional(),
});

export type TvExtra = z.output<typeof tvExtraSchema>;

/** Most tracks kept per release, so a large box set stays a reasonable cache row. */
export const MAX_TRACKLIST_LENGTH = 500;

/** One format of a release, e.g. `2 × Vinyl, LP, 45 RPM` (Discogs `formats[]`). */
export const musicFormatSchema = z.object({
  /** e.g. `Vinyl`, `CD`, `Cassette`, `File`, `Box Set`. */
  name: text,
  /** How many of it the release has (discs, tapes). */
  quantity: z.int().min(1).optional(),
  /** e.g. `LP`, `12"`, `45 RPM`, `Album`, `Picture Disc`. */
  descriptions: z.array(text).optional(),
  /** Free text, e.g. `Red Translucent`. */
  text: text.optional(),
});

export type MusicFormatInfo = z.output<typeof musicFormatSchema>;

export const musicLabelSchema = z.object({
  name: text,
  catalogNumber: text.optional(),
});

export type MusicLabel = z.output<typeof musicLabelSchema>;

export const musicTrackSchema = z.object({
  /** e.g. `A1`, `2-05`. */
  position: text.optional(),
  title: text,
  /** As the provider writes it, e.g. `4:19`. */
  duration: text.optional(),
});

export type MusicTrack = z.output<typeof musicTrackSchema>;

/** Most matrix / runout codes kept per release. */
export const MAX_MATRIX_CODES = 50;

/** A code etched in a record's runout groove (or a CD's inner ring), e.g. `YEX 749-2`. */
export const musicMatrixSchema = z.object({
  value: text,
  /** Which side or variant it is on, e.g. `Side A runout, variant 1`. */
  description: text.optional(),
});

export type MusicMatrix = z.output<typeof musicMatrixSchema>;

/** A Discogs release (one pressing) or master (the album across pressings), FC-10. */
export const musicExtraSchema = z.object({
  /** `release` items have labels and formats; a `master` has neither. */
  discogsType: z.enum(['release', 'master']).optional(),
  /** Release country, e.g. `UK`. */
  country: text.optional(),
  labels: z.array(musicLabelSchema).optional(),
  /** The first real catalog number of the labels. Suggested for the copy (`prefillDetails`). */
  catalogNumber: text.optional(),
  /** Offered as the copy's medium, discs and vinyl details (`prefillDetails`). */
  formats: z.array(musicFormatSchema).optional(),
  tracklist: z.array(musicTrackSchema).max(MAX_TRACKLIST_LENGTH).optional(),
  /** Barcodes printed on the release (EAN / UPC), as Discogs writes them. */
  barcodes: z.array(text).max(MAX_MATRIX_CODES).optional(),
  /** Matrix / runout codes: they tell almost identical pressings apart. */
  matrix: z.array(musicMatrixSchema).max(MAX_MATRIX_CODES).optional(),
  /** The master a release belongs to. */
  masterId: z.int().min(1).optional(),
});

export type MusicExtra = z.output<typeof musicExtraSchema>;

/** Most platforms kept per game. */
export const MAX_GAME_PLATFORMS = 100;

/** An IGDB platform, e.g. `{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }`. */
export const gamePlatformSchema = z.object({
  /** The IGDB platform ID. */
  id: z.int().min(1),
  /** Stored as the copy's `platform` (FC-11). */
  name: text,
  /** Short name for badges, e.g. `PS5`, `PC`. */
  abbreviation: text.optional(),
});

export type GamePlatform = z.output<typeof gamePlatformSchema>;

/** An IGDB game (FC-11). Its developers are the item's `creators`. */
export const videoGameExtraSchema = z.object({
  /** The platforms the game came out on; offered as the copy's platform (`prefillDetails`). */
  platforms: z.array(gamePlatformSchema).max(MAX_GAME_PLATFORMS).optional(),
  publishers: z.array(text).optional(),
  /** IGDB game type, e.g. `Main Game`, `Remaster`, `Expansion`. */
  gameType: text.optional(),
});

export type VideoGameExtra = z.output<typeof videoGameExtraSchema>;

// Not defined yet: BoardGameExtra: FC-12. Hand-entered items have no extra; their fields are in
// `custom_data` (FC-13).

export function parseMovieExtra(extra: unknown): MovieExtra | undefined {
  const result = movieExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}

export function parseTvExtra(extra: unknown): TvExtra | undefined {
  const result = tvExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}

export function parseMusicExtra(extra: unknown): MusicExtra | undefined {
  const result = musicExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}

export function parseVideoGameExtra(extra: unknown): VideoGameExtra | undefined {
  const result = videoGameExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}
