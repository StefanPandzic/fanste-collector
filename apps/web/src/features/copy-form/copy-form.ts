import {
  COPY_DETAIL_STATUSES,
  customDetailsShape,
  musicDetailsShape,
  videoGameDetailsShape,
} from '@fanste/core';

import type {
  CopyOption,
  CustomDetails,
  GamePlatform,
  ItemCategory,
  MusicDetails,
  OwnershipStatus,
  TvDetails,
  VideoGameDetails,
} from '@fanste/core';

// Form helpers shared by the "Add with details" dialog (FC-17) and the item page (FC-19).

/**
 * How a field reports a change: `immediate` for a pick (select, checkbox, list), which an autosaving
 * form saves at once; typed text waits for a pause.
 */
export interface ChangeOptions {
  immediate?: boolean;
}

/** Whether the status is of a copy the user has, whose medium and details the form shows. */
export function showsCopyDetails(ownership: OwnershipStatus): boolean {
  return COPY_DETAIL_STATUSES.includes(ownership);
}

/** What a category's copy details are, for the hint shown while they're hidden. */
export function copyDetailsSummary(category: ItemCategory): string {
  if (category === 'music') return 'medium, pressing, condition';
  if (category === 'video_game') return 'medium, platform, storefront';
  if (category === 'custom') return 'medium, condition, variant';
  return 'medium, quality, languages';
}

/** The container (`fileFormat`) only applies to a `Digital file` copy. */
export function showsFileFormat(format: string): boolean {
  return format === 'Digital file';
}

/** The store (`digitalStore`) only applies to a `Digital store` copy. */
export function showsDigitalStore(format: string): boolean {
  return format === 'Digital store';
}

/** The record's size, speed and variant only apply to a `Vinyl` copy (FC-10). */
export function showsVinylDetails(format: string): boolean {
  return format === 'Vinyl';
}

/** The storefront only applies to a digital game copy (FC-11). */
export function showsStorefront(format: string): boolean {
  return format === 'Digital' || format === 'Digital code';
}

/** The disc count only applies to a game on discs. */
export function showsGameDiscs(format: string): boolean {
  return format === 'Disc';
}

/** The region and completeness only apply to a physical game (a disc or a cartridge). */
export function showsPhysicalGameDetails(format: string): boolean {
  return format === 'Disc' || format === 'Cartridge';
}

/**
 * The copy details a form holds: the movie and TV fields (`TvDetails` adds `seasons`), the music
 * fields (FC-10), the video game fields (FC-11) or a custom item's (FC-13). Each category's form only
 * shows and saves its own.
 */
export type CopyFormDetails = TvDetails & MusicDetails & VideoGameDetails & CustomDetails;

const VINYL_FIELDS = ['vinylSize', 'speed', 'variant'] as const;
const MUSIC_FIELDS = Object.keys(musicDetailsShape) as (keyof MusicDetails)[];
const GAME_FIELDS = Object.keys(videoGameDetailsShape) as (keyof VideoGameDetails)[];
const CUSTOM_FIELDS = Object.keys(customDetailsShape) as (keyof CustomDetails)[];

/** Whether a game copy in medium `format` shows `field`. */
function showsGameField(format: string, field: keyof VideoGameDetails): boolean {
  if (field === 'storefront') return showsStorefront(format);
  if (field === 'discCount') return showsGameDiscs(format);
  if (field === 'region' || field === 'completeness') return showsPhysicalGameDetails(format);
  return true;
}

/**
 * The game details a copy still has once its medium is `format` (FC-11): an autosaving form clears
 * them when the medium changes, so a disc never matches the Steam filter.
 */
export function staleGameFields(
  format: string,
  details: VideoGameDetails,
): (keyof VideoGameDetails)[] {
  return GAME_FIELDS.filter(
    (field) => details[field] !== undefined && !showsGameField(format, field),
  );
}

/** The options of a game's platform field: the game's own platforms, then every other one. */
export function platformOptions(
  gamePlatforms: readonly GamePlatform[] | undefined,
  allPlatforms: readonly GamePlatform[] | undefined,
): { options: CopyOption[]; more: CopyOption[] } {
  const toOption = (name: string): CopyOption => ({ value: name, label: name });
  const own = new Set((gamePlatforms ?? []).map((platform) => platform.name));
  return {
    options: [...own].map(toOption),
    more: (allPlatforms ?? [])
      .filter((platform) => !own.has(platform.name))
      .map((platform) => toOption(platform.name)),
  };
}

/**
 * The vinyl details a music copy still has once its medium is `format`: an autosaving form clears
 * them when the medium moves off Vinyl, so a CD never matches a vinyl-size filter.
 */
export function staleVinylFields(
  format: string,
  details: MusicDetails,
): (typeof VINYL_FIELDS)[number][] {
  if (showsVinylDetails(format)) return [];
  return VINYL_FIELDS.filter((field) => details[field] !== undefined);
}

/**
 * The details of the category that the form shows for the medium: fields hidden for it (a movie's
 * file format on a disc, a record's speed on a CD) aren't saved.
 */
export function shownDetails(
  category: ItemCategory,
  format: string,
  details: CopyFormDetails,
): Record<string, unknown> {
  if (category === 'video_game') {
    return Object.fromEntries(
      GAME_FIELDS.filter((field) => showsGameField(format, field)).map((field) => [
        field,
        details[field],
      ]),
    );
  }
  if (category === 'custom') {
    return Object.fromEntries(CUSTOM_FIELDS.map((field) => [field, details[field]]));
  }
  if (category === 'music') {
    return Object.fromEntries(
      MUSIC_FIELDS.filter(
        (field) =>
          showsVinylDetails(format) || !(VINYL_FIELDS as readonly string[]).includes(field),
      ).map((field) => [field, details[field]]),
    );
  }
  const { fileFormat, digitalStore, ...rest } = details;
  return {
    ...rest,
    ...(showsFileFormat(format) ? { fileFormat } : {}),
    ...(showsDigitalStore(format) ? { digitalStore } : {}),
  };
}

/** Whether a form value counts as "not set": `undefined`, blank text or an empty list. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Drops empty values: blank text, empty lists, `undefined`. */
export function cleanDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => !isEmptyValue(value)));
}

/** An amount as typed (`12,50` or `12.50`); `NaN` when it isn't a number, so validation reports it. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return /^\d+([.,]\d{1,2})?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** A whole number as typed; `NaN` when it isn't one. */
export function parseCount(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
}

/** Messages per copy field (top-level fields, and `details.<field>`). */
export const COPY_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  ownership: 'Choose a status.',
  quantity: 'Enter a whole number from 1 to 9999.',
  acquiredAt: 'Enter a valid date.',
  purchasePrice: 'Enter an amount of 0 or more, with at most two decimals.',
  estimatedValue: 'Enter an amount of 0 or more, with at most two decimals.',
  currency: 'Choose a currency.',
  notes: 'Notes can be at most 5000 characters.',
  format: 'The medium can be at most 100 characters.',
  'details.discCount': 'Enter a number of discs from 1 to 99.',
  'details.catalogNumber': 'The catalog number can be at most 100 characters.',
  'details.variant': 'The variant can be at most 100 characters.',
  'details.dlcNotes': 'DLC notes can be at most 1000 characters.',
  'details.seasons': 'Pick at least one episode for each ticked season.',
};

/** Field errors of a failed zod parse, keyed like `COPY_FIELD_MESSAGES`. */
export function copyFieldErrors(
  issues: readonly { path: readonly PropertyKey[] }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const [head, field] = issue.path.map(String);
    const key = head === 'details' && field ? `details.${field}` : (head ?? 'form');
    errors[key] ??= copyFieldMessage(key);
  }
  return errors;
}

/** The message of a copy field key (`quantity`, `details.discCount`, ...). */
export function copyFieldMessage(key: string): string {
  return COPY_FIELD_MESSAGES[key] ?? 'Check this value.';
}
