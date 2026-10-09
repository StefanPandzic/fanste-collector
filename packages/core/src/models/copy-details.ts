import { z } from 'zod';

import { ITEM_CATEGORIES } from './enums';
import { jsonByteLength, parseFields } from './lenient';

import type { ItemCategory, OwnershipStatus } from './enums';
import type { TvExtra } from './extras';

// The user's own copy (FC-15): facts about it that no provider knows, stored in
// `collection_items.details` next to the `format` column. Every field is optional. Option fields are
// free text (the lists in `copy-options.ts` are suggestions), so "Other" values fit.
//
// Movies & TV ship first. The other categories keep a loose record until their provider tasks type
// it: music FC-10, video games FC-11, board games FC-12, Funko FC-13.

/** Longest value of an option field such as `edition` or `digitalStore`. */
export const MAX_OPTION_LENGTH = 100;
export const MAX_DISC_COUNT = 99;
export const MAX_EPISODE_NUMBER = 9999;
/**
 * Largest `details` object as JSON. The database allows twice as much (`octet_length(details::text)`
 * counts the spaces Postgres adds), so this check always fails first.
 */
export const MAX_DETAILS_BYTES = 8 * 1024;

/**
 * Statuses of a copy the user has, whose details the UI shows. `wishlist` hides them and `sold` shows
 * them read-only; the data is kept either way, so changing the status loses nothing.
 */
export const COPY_DETAIL_STATUSES: readonly OwnershipStatus[] = [
  'owned',
  'loaned_out',
  'preordered',
];

const optionText = z.string().trim().min(1).max(MAX_OPTION_LENGTH);

/** ISO 639 language code, e.g. `en` or `sr` (see `LANGUAGE_CODES`). */
export const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}$/);

/** Unique language codes; order matters (the first audio language is the main one). */
const languages = z
  .array(languageCodeSchema)
  .max(50)
  .transform((codes) => [...new Set(codes)]);

const discCount = z.int().min(1).max(MAX_DISC_COUNT);

/** `'all'`, or the owned episode numbers (sorted, unique). */
export const episodesOwnedSchema = z.union([
  z.literal('all'),
  z
    .array(z.int().min(1).max(MAX_EPISODE_NUMBER))
    .min(1)
    .max(MAX_EPISODE_NUMBER)
    .transform((episodes) => [...new Set(episodes)].sort((a, b) => a - b)),
]);

export type EpisodesOwned = z.output<typeof episodesOwnedSchema>;

/** Fields of a movie copy, and the show-wide defaults of a TV copy. */
export const movieDetailsShape = {
  /** e.g. `2160p` (see `RESOLUTIONS`). */
  resolution: optionText.optional(),
  /** e.g. `Dolby Vision`, or `none` (see `HDR_FORMATS`). */
  hdr: optionText.optional(),
  /** e.g. `5.1` (see `AUDIO_CHANNELS`). */
  audioChannels: optionText.optional(),
  /** Container of a `Digital file` copy, e.g. `MKV` (see `VIDEO_FILE_FORMATS`). */
  fileFormat: optionText.optional(),
  /** e.g. `Steelbook` (see `MOVIE_EDITIONS`). */
  edition: optionText.optional(),
  discCount: discCount.optional(),
  /** e.g. `B` or `2` (see `DISC_REGIONS`). */
  region: optionText.optional(),
  /** One or more; the first is the main language. */
  audioLanguages: languages.optional(),
  subtitleLanguages: languages.optional(),
  /** Where a `Digital store` copy was bought (see `DIGITAL_STORES`). */
  digitalStore: optionText.optional(),
};

/** Fields a season can set differently from the show (e.g. season 1 on DVD, season 2 as MKV). */
const seasonOverrideShape = {
  /** Medium of this season, e.g. `DVD` (see `MOVIE_TV_FORMATS`). */
  format: optionText.optional(),
  resolution: movieDetailsShape.resolution,
  audioChannels: movieDetailsShape.audioChannels,
  fileFormat: movieDetailsShape.fileFormat,
  audioLanguages: movieDetailsShape.audioLanguages,
  subtitleLanguages: movieDetailsShape.subtitleLanguages,
};

/** One owned season of a TV copy. A season missing from `seasons` isn't owned. */
export const tvSeasonDetailsSchema = z.object({
  /** Matches `TvExtra.seasons[].seasonNumber`; `0` is "Specials". */
  seasonNumber: z.int().min(0).max(MAX_EPISODE_NUMBER),
  episodesOwned: episodesOwnedSchema,
  ...seasonOverrideShape,
});

export type TvSeasonDetails = z.output<typeof tvSeasonDetailsSchema>;

const seasons = z
  .array(tvSeasonDetailsSchema)
  .max(500)
  .refine(
    (list) => new Set(list.map((season) => season.seasonNumber)).size === list.length,
    'Each season can only be listed once.',
  )
  .transform((list) => list.toSorted((a, b) => a.seasonNumber - b.seasonNumber));

export const tvDetailsShape = { ...movieDetailsShape, seasons: seasons.optional() };

function withSizeLimit<T extends z.ZodType>(schema: T) {
  return schema.refine(
    (value) => jsonByteLength(value) <= MAX_DETAILS_BYTES,
    `Copy details can be at most ${MAX_DETAILS_BYTES / 1024} KB.`,
  );
}

export const movieDetailsSchema = withSizeLimit(z.object(movieDetailsShape));
export const tvDetailsSchema = withSizeLimit(z.object(tvDetailsShape));
/** Details of a category that isn't typed yet. */
export const looseDetailsSchema = withSizeLimit(z.record(z.string(), z.unknown()));

export type MovieDetails = z.output<typeof movieDetailsSchema>;
export type TvDetails = z.output<typeof tvDetailsSchema>;
export type LooseDetails = z.output<typeof looseDetailsSchema>;

/** The `details` type of each category. */
export interface DetailsByCategory {
  movie: MovieDetails;
  tv: TvDetails;
  music: LooseDetails;
  video_game: LooseDetails;
  board_game: LooseDetails;
  funko: LooseDetails;
}

const DETAILS_SCHEMAS = {
  movie: movieDetailsSchema,
  tv: tvDetailsSchema,
  music: looseDetailsSchema,
  video_game: looseDetailsSchema,
  board_game: looseDetailsSchema,
  funko: looseDetailsSchema,
} satisfies Record<ItemCategory, z.ZodType>;

/** The strict schema of a category's `details`, for validating user input. */
export function detailsSchemaFor<C extends ItemCategory>(category: C): (typeof DETAILS_SCHEMAS)[C] {
  return DETAILS_SCHEMAS[category];
}

const medium = optionText.nullable().optional();
const untypedCategories = ITEM_CATEGORIES.filter(
  (category) => category !== 'movie' && category !== 'tv',
);

/**
 * A copy's medium (`format` column) and details, typed by category. Forms (FC-17, FC-19) validate
 * against it.
 */
export const copyDetailsSchema = z.discriminatedUnion('category', [
  z.object({ category: z.literal('movie'), format: medium, details: movieDetailsSchema }),
  z.object({ category: z.literal('tv'), format: medium, details: tvDetailsSchema }),
  z.object({ category: z.enum(untypedCategories), format: medium, details: looseDetailsSchema }),
]);

export type CopyDetails = z.output<typeof copyDetailsSchema>;

/**
 * Reads stored `details` for display: keeps the valid fields and drops the rest, so it never throws.
 * Use `detailsSchemaFor` to validate input instead.
 */
export function parseDetails<C extends ItemCategory>(
  category: C,
  value: unknown,
): DetailsByCategory[C] {
  if (category === 'movie') return parseFields(movieDetailsShape, value);
  if (category === 'tv') {
    const details: TvDetails = parseFields(movieDetailsShape, value);
    const list = (value as { seasons?: unknown } | null)?.seasons;
    if (Array.isArray(list)) {
      // Keep each valid season, and the first of duplicate season numbers.
      const valid = list.flatMap((entry) => {
        const result = tvSeasonDetailsSchema.safeParse(entry);
        return result.success ? [result.data] : [];
      });
      const unique = valid.filter(
        (season, index) =>
          valid.findIndex((other) => other.seasonNumber === season.seasonNumber) === index,
      );
      if (unique.length > 0) {
        details.seasons = unique.toSorted((a, b) => a.seasonNumber - b.seasonNumber);
      }
    }
    return details;
  }
  const loose = looseDetailsSchema.safeParse(value);
  return loose.success ? loose.data : {};
}

// ---------------------------------------------------------------------------------------------------
// TV seasons
// ---------------------------------------------------------------------------------------------------

/**
 * An owned season of a TV copy, with the show's defaults (`details` and the copy's `format`) filling
 * the fields the season doesn't set. `undefined` when the season isn't owned.
 */
export function seasonDetails(
  details: TvDetails,
  seasonNumber: number,
  showFormat?: string | null,
): TvSeasonDetails | undefined {
  const season = details.seasons?.find((entry) => entry.seasonNumber === seasonNumber);
  if (!season) return undefined;
  const resolved: TvSeasonDetails = { ...season };
  const format = season.format ?? showFormat ?? undefined;
  if (format !== undefined) resolved.format = format;
  for (const key of [
    'resolution',
    'audioChannels',
    'fileFormat',
    'audioLanguages',
    'subtitleLanguages',
  ] as const) {
    if (resolved[key] === undefined && details[key] !== undefined) {
      // Same key, same type on both sides.
      (resolved as Record<string, unknown>)[key] = details[key];
    }
  }
  return resolved;
}

export interface OwnedEpisodes {
  /** Seasons owned completely. */
  fullSeasons: number;
  /** Episodes owned in seasons that aren't complete. */
  extraEpisodes: number;
  /** All owned episodes; `undefined` when a complete season's episode count is unknown. */
  totalEpisodes: number | undefined;
}

/**
 * How much of a show the copy holds. A season counts as complete when it's `'all'`, or when its list
 * has every episode of the season's count from TMDB (`tvExtra`).
 */
export function ownedEpisodeCount(details: TvDetails, tvExtra: TvExtra | undefined): OwnedEpisodes {
  const counts: OwnedEpisodes = { fullSeasons: 0, extraEpisodes: 0, totalEpisodes: 0 };
  for (const season of details.seasons ?? []) {
    const episodeCount = tvExtra?.seasons?.find(
      (entry) => entry.seasonNumber === season.seasonNumber,
    )?.episodeCount;
    if (season.episodesOwned === 'all') {
      counts.fullSeasons += 1;
      counts.totalEpisodes =
        counts.totalEpisodes === undefined || episodeCount === undefined
          ? undefined
          : counts.totalEpisodes + episodeCount;
      continue;
    }
    const owned = season.episodesOwned.length;
    const complete =
      episodeCount !== undefined &&
      episodeCount > 0 &&
      season.episodesOwned.filter((episode) => episode <= episodeCount).length === episodeCount;
    if (complete) counts.fullSeasons += 1;
    else counts.extraEpisodes += owned;
    if (counts.totalEpisodes !== undefined) counts.totalEpisodes += owned;
  }
  return counts;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** e.g. `1 full season + 4 episodes`, `2 full seasons`, `4 episodes`, `No episodes`. */
export function formatOwnedEpisodes({ fullSeasons, extraEpisodes }: OwnedEpisodes): string {
  const parts = [];
  if (fullSeasons > 0) parts.push(plural(fullSeasons, 'full season', 'full seasons'));
  if (extraEpisodes > 0) parts.push(plural(extraEpisodes, 'episode', 'episodes'));
  return parts.length > 0 ? parts.join(' + ') : 'No episodes';
}
