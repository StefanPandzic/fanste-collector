import { z } from 'zod';

import { MAX_FORMAT_LENGTH } from './collection-input';
import { MAX_OPTION_LENGTH, parseDetails } from './copy-details';
import { itemCategorySchema } from './enums';
import { parseMovieExtra, parseMusicExtra, parseTvExtra } from './extras';

import type { AddItemInput } from './collection-input';
import type { DetailsByCategory, TvDetails, TvSeasonDetails } from './copy-details';
import type { ExternalProvider, ItemCategory } from './enums';
import type { MusicExtra, MusicFormatInfo, TvSeason } from './extras';
import type { NormalizedItem } from './normalized-item';

// Suggested copy details when an item is added (FC-15): the user sees them in the add dialog (FC-17)
// and can change any of them before saving. Music suggestions come from the Discogs release (FC-10);
// IGDB and BGG suggestions come with FC-11 / FC-12.

/** What the desktop scanner knows about a file (FC-21 / FC-22), used by FC-23. */
export interface ScanPrefill {
  /** Container, e.g. `MKV`. */
  fileFormat?: string;
  resolution?: string;
  hdr?: string;
  audioChannels?: string;
  /** From sidecar subtitle files, as ISO 639 codes. */
  subtitleLanguages?: string[];
  /** TV: the scanned episodes. */
  episodes?: { seasonNumber: number; episodeNumber: number }[];
}

/**
 * Detail fields remembered from the user's last add, per category: habits like "always 4K", never
 * facts about one title (edition, discs, seasons, audio language).
 */
export const REMEMBERED_DETAIL_FIELDS: Partial<Record<ItemCategory, readonly string[]>> = {
  movie: [
    'resolution',
    'hdr',
    'audioChannels',
    'fileFormat',
    'region',
    'subtitleLanguages',
    'digitalStore',
  ],
  tv: [
    'resolution',
    'hdr',
    'audioChannels',
    'fileFormat',
    'region',
    'subtitleLanguages',
    'digitalStore',
  ],
  // Discs, vinyl details, catalog number and condition all describe one record, not a habit; only
  // the medium (`format`) is remembered.
  music: [],
};

/** The last-used medium and detail habits of a category (`profiles.preferences.copyDefaults`). */
export const copyDefaultsSchema = z.object({
  format: z.string().trim().min(1).max(MAX_FORMAT_LENGTH).optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type CopyDefaults = z.output<typeof copyDefaultsSchema>;

/** `profiles.preferences`. Other keys are kept as they are. */
export interface UserPreferences {
  copyDefaults: Partial<Record<ItemCategory, CopyDefaults>>;
}

/** Reads `profiles.preferences`, dropping invalid entries instead of throwing. */
export function parsePreferences(value: unknown): UserPreferences {
  const preferences: UserPreferences = { copyDefaults: {} };
  const stored = (value as { copyDefaults?: unknown } | null)?.copyDefaults;
  if (typeof stored !== 'object' || stored === null) return preferences;
  for (const [key, entry] of Object.entries(stored)) {
    const category = itemCategorySchema.safeParse(key);
    const defaults = copyDefaultsSchema.safeParse(entry);
    if (category.success && defaults.success) {
      preferences.copyDefaults[category.data] = defaults.data;
    }
  }
  return preferences;
}

/** What to remember from a copy the user just added. */
export function copyDefaultsFrom(
  category: ItemCategory,
  format: string | null | undefined,
  details: Record<string, unknown> | undefined,
): CopyDefaults {
  const fields = REMEMBERED_DETAIL_FIELDS[category] ?? [];
  const remembered = Object.fromEntries(
    fields.flatMap((field) => (details?.[field] === undefined ? [] : [[field, details[field]]])),
  );
  return { ...(format ? { format } : {}), details: remembered };
}

export interface PrefillContext {
  /** From the desktop scanner (FC-23). When present, the last-used defaults aren't applied. */
  scan?: ScanPrefill;
  /** The user's last-used values for the category (`UserPreferences.copyDefaults`). */
  defaults?: CopyDefaults;
}

/**
 * Where a suggested value came from: the user's last-used values, the provider metadata or the
 * desktop scanner. The add dialog (FC-17) marks prefilled fields with it.
 */
export type PrefillSource = 'defaults' | 'provider' | 'scan';

export interface PrefillResult<C extends ItemCategory = ItemCategory> {
  /** Suggested medium (`format` column). */
  format?: string;
  details: DetailsByCategory[C];
  /** Values the UI offers to pick from, e.g. the show's seasons for `seasons[]`. */
  choices: {
    seasons?: TvSeason[];
  };
  /** The source of each suggested value, keyed by `format` or the `details` field name. */
  sources: Record<string, PrefillSource>;
}

/**
 * Suggested `format` and `details` for a new copy, from (lowest priority first) the user's last-used
 * values, the provider metadata and the desktop scanner.
 */
export function prefillDetails<C extends ItemCategory>(
  category: C,
  item: NormalizedItem | null | undefined,
  { scan, defaults }: PrefillContext = {},
): PrefillResult<C> {
  let format: string | undefined;
  const details: Record<string, unknown> = {};
  const choices: PrefillResult['choices'] = {};
  const sources: Record<string, PrefillSource> = {};

  function suggest(field: string, value: unknown, source: PrefillSource) {
    details[field] = value;
    sources[field] = source;
  }

  if (defaults && !scan) {
    format = defaults.format;
    if (format) sources.format = 'defaults';
    for (const [field, value] of Object.entries(defaults.details))
      suggest(field, value, 'defaults');
  }

  if (item && (category === 'movie' || category === 'tv')) {
    const extra = category === 'movie' ? parseMovieExtra(item.extra) : parseTvExtra(item.extra);
    if (extra?.originalLanguage) suggest('audioLanguages', [extra.originalLanguage], 'provider');
    if (category === 'tv') {
      const seasons = extra && 'seasons' in extra ? extra.seasons : undefined;
      if (seasons && seasons.length > 0) choices.seasons = seasons;
    }
  }

  if (item && category === 'music') {
    const music = musicPrefill(parseMusicExtra(item.extra));
    if (music.format) {
      format = music.format;
      sources.format = 'provider';
    }
    for (const [field, value] of Object.entries(music.details)) suggest(field, value, 'provider');
  }

  if (scan) {
    format = 'Digital file';
    sources.format = 'scan';
    for (const key of ['fileFormat', 'resolution', 'hdr', 'audioChannels'] as const) {
      if (scan[key]) suggest(key, scan[key], 'scan');
    }
    if (scan.subtitleLanguages && scan.subtitleLanguages.length > 0) {
      suggest('subtitleLanguages', scan.subtitleLanguages, 'scan');
    }
    if (category === 'tv' && scan.episodes && scan.episodes.length > 0) {
      suggest('seasons', seasonsFromEpisodes(scan.episodes, choices.seasons), 'scan');
    }
  }

  const parsed = parseDetails(category, details);
  // Invalid values are dropped while parsing, and so are their sources.
  const kept = new Set([...Object.keys(parsed), ...(format ? ['format'] : [])]);
  return {
    ...(format ? { format } : {}),
    details: parsed,
    choices,
    sources: Object.fromEntries(Object.entries(sources).filter(([field]) => kept.has(field))),
  };
}

/**
 * Every season of a show as fully owned, without Specials (season 0): the default of a new TV copy
 * from search (FC-17).
 */
export function allSeasonsOwned(seasons: readonly TvSeason[] | undefined): TvSeasonDetails[] {
  return (seasons ?? [])
    .filter((season) => season.seasonNumber > 0)
    .map((season) => ({ seasonNumber: season.seasonNumber, episodesOwned: 'all' }));
}

/**
 * For a TV prefill without owned seasons (no scan), suggests every season but the Specials, marked
 * as coming from the provider. Other prefills are returned as they are.
 */
export function ownAllSeasons<C extends ItemCategory>(
  category: C,
  prefill: PrefillResult<C>,
): PrefillResult<C> {
  if (category !== 'tv' || (prefill.details as TvDetails).seasons) return prefill;
  const seasons = allSeasonsOwned(prefill.choices.seasons);
  if (seasons.length === 0) return prefill;
  return {
    ...prefill,
    details: { ...prefill.details, seasons },
    sources: { ...prefill.sources, seasons: 'provider' },
  };
}

/**
 * The input of a one-click add from search (FC-17): owned, with the suggested medium and details
 * (the user's last-used values and the provider's original language). A TV copy owns every season
 * but the Specials.
 */
export function quickAddInput(
  target: { category: ItemCategory; provider: ExternalProvider; externalId: string },
  item: NormalizedItem,
  defaults: CopyDefaults | undefined,
): AddItemInput {
  const prefill = ownAllSeasons(
    target.category,
    prefillDetails(target.category, item, { defaults }),
  );
  return {
    ...target,
    ownership: 'owned',
    ...(prefill.format ? { format: prefill.format } : {}),
    details: prefill.details,
    source: 'search',
  };
}

/**
 * Groups scanned episodes into owned seasons. A season whose files cover every episode of its TMDB
 * count becomes `'all'`.
 */
function seasonsFromEpisodes(
  episodes: NonNullable<ScanPrefill['episodes']>,
  showSeasons: TvSeason[] | undefined,
): TvSeasonDetails[] {
  const bySeason = new Map<number, Set<number>>();
  for (const { seasonNumber, episodeNumber } of episodes) {
    const set = bySeason.get(seasonNumber) ?? new Set<number>();
    set.add(episodeNumber);
    bySeason.set(seasonNumber, set);
  }
  return [...bySeason].map(([seasonNumber, set]) => {
    const episodeCount = showSeasons?.find(
      (season) => season.seasonNumber === seasonNumber,
    )?.episodeCount;
    const numbers = [...set].sort((a, b) => a - b);
    const complete =
      episodeCount !== undefined &&
      episodeCount > 0 &&
      numbers.filter((episode) => episode <= episodeCount).length === episodeCount;
    return { seasonNumber, episodesOwned: complete ? 'all' : numbers };
  });
}

// ---------------------------------------------------------------------------------------------------
// Music (FC-10)
// ---------------------------------------------------------------------------------------------------

/** Discogs format names → the music media of `MUSIC_FORMATS`. Others (`Box Set`, ...) are skipped. */
const DISCOGS_MEDIA: Record<string, string> = {
  Vinyl: 'Vinyl',
  CD: 'CD',
  CDr: 'CD',
  SACD: 'CD',
  Cassette: 'Cassette',
  File: 'Digital',
};

const VINYL_SIZE_DESCRIPTIONS = ['7"', '10"', '12"'];

/** Discogs speed descriptions → `VINYL_SPEEDS` values. */
const SPEED_DESCRIPTIONS: Record<string, string> = {
  '33 ⅓ RPM': '33⅓',
  '45 RPM': '45',
  '78 RPM': '78',
};

/** Descriptions that are the record's variant. */
const VARIANT_DESCRIPTIONS = ['Picture Disc', 'Shape'];

/** Format text that names a color or finish, e.g. `Red Translucent`, `Splatter`. */
const VARIANT_TEXT =
  /\b(black|white|red|blue|green|yellow|orange|pink|purple|violet|gold|silver|grey|gray|clear|transparent|translucent|marbled?|splatter|swirl|colou?red|smoke|opaque)\b/i;

/**
 * The medium and copy details a Discogs release suggests: the first known format is the medium, its
 * quantity (summed over the release's formats of that medium) the discs, and for vinyl the size,
 * speed and variant from its descriptions. An `LP` without a size is a 12" at 33⅓ RPM.
 */
export function musicPrefill(extra: MusicExtra | undefined): {
  format?: string;
  details: Record<string, unknown>;
} {
  const details: Record<string, unknown> = {};
  if (extra?.catalogNumber) {
    details.catalogNumber = extra.catalogNumber.slice(0, MAX_OPTION_LENGTH).trim();
  }

  const formats = extra?.formats ?? [];
  const primary = formats.find((entry) => DISCOGS_MEDIA[entry.name] !== undefined);
  if (!primary) return { details };
  const format = DISCOGS_MEDIA[primary.name];
  const same = formats.filter((entry) => DISCOGS_MEDIA[entry.name] === format);
  const discs = same.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0);
  if (discs >= 1) details.discCount = discs;

  if (format === 'Vinyl') Object.assign(details, vinylDetails(same));
  return { format, details };
}

function vinylDetails(formats: readonly MusicFormatInfo[]): Record<string, unknown> {
  const descriptions = formats.flatMap((entry) => entry.descriptions ?? []);
  const isLp = descriptions.includes('LP');
  const details: Record<string, unknown> = {};

  const size = descriptions.find((entry) => VINYL_SIZE_DESCRIPTIONS.includes(entry));
  if (size) details.vinylSize = size;
  else if (isLp) details.vinylSize = '12"';

  const speed = descriptions.flatMap((entry) => SPEED_DESCRIPTIONS[entry] ?? [])[0];
  if (speed) details.speed = speed;
  else if (isLp) details.speed = '33⅓';

  const variant =
    descriptions.find((entry) => VARIANT_DESCRIPTIONS.includes(entry)) ??
    // The color part of a text like `Red Translucent, Gatefold, 180 Gram`.
    formats
      .flatMap((entry) => entry.text?.split(',') ?? [])
      .map((part) => part.trim().slice(0, MAX_OPTION_LENGTH))
      .find((part) => VARIANT_TEXT.test(part));
  if (variant) details.variant = variant;
  return details;
}
