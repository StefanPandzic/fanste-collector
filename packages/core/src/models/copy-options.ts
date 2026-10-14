// Suggested values for the copy-details fields (FC-15). The fields are free text, so the UI offers
// these lists and also accepts an "Other" value, except for the condition grades, which are a fixed
// scale. Board games and Funko get their lists with FC-12 / FC-13.

/** A suggested value and how the UI shows it. */
export interface CopyOption {
  readonly value: string;
  readonly label: string;
}

/** Options whose label is the value itself. */
function plain(values: readonly string[]): readonly CopyOption[] {
  return values.map((value) => ({ value, label: value }));
}

export const RESOLUTIONS = [
  { value: '480p', label: '480p (SD)' },
  { value: '576p', label: '576p (SD)' },
  { value: '720p', label: '720p (HD)' },
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '2160p', label: '2160p (4K)' },
] as const satisfies readonly CopyOption[];

export const HDR_FORMATS = [
  { value: 'none', label: 'None (SDR)' },
  { value: 'HDR10', label: 'HDR10' },
  { value: 'HDR10+', label: 'HDR10+' },
  { value: 'Dolby Vision', label: 'Dolby Vision' },
] as const satisfies readonly CopyOption[];

export const AUDIO_CHANNELS = plain(['1.0', '2.0', '2.1', '5.1', '6.1', '7.1', '7.1.4']);

/** Containers of a `Digital file` copy. */
export const VIDEO_FILE_FORMATS = plain([
  'MKV',
  'MP4',
  'AVI',
  'MOV',
  'M4V',
  'WMV',
  'M2TS',
  'TS',
  'WebM',
  'ISO',
  'VIDEO_TS',
  'BDMV',
]);

export const MOVIE_EDITIONS = plain([
  'Standard',
  "Collector's",
  'Steelbook',
  "Director's Cut",
  'Extended',
  'Limited',
  'Special',
  'Criterion',
]);

/** Blu-ray regions (A/B/C) and DVD regions (1–6), plus region-free discs. */
export const DISC_REGIONS = [
  { value: 'A', label: 'Blu-ray A' },
  { value: 'B', label: 'Blu-ray B' },
  { value: 'C', label: 'Blu-ray C' },
  { value: '1', label: 'DVD 1' },
  { value: '2', label: 'DVD 2' },
  { value: '3', label: 'DVD 3' },
  { value: '4', label: 'DVD 4' },
  { value: '5', label: 'DVD 5' },
  { value: '6', label: 'DVD 6' },
  { value: 'Region-free', label: 'Region-free' },
] as const satisfies readonly CopyOption[];

/** Where a `Digital store` copy was bought. */
export const DIGITAL_STORES = plain([
  'Apple TV',
  'Google Play',
  'Amazon',
  'Movies Anywhere',
  'Microsoft Store',
  'Vudu',
  'Rakuten TV',
]);

// ---------------------------------------------------------------------------------------------------
// Music (FC-10)
// ---------------------------------------------------------------------------------------------------

/** Record sizes. Stored with a plain `"`, as Discogs writes them. */
export const VINYL_SIZES = [
  { value: '7"', label: '7″' },
  { value: '10"', label: '10″' },
  { value: '12"', label: '12″' },
] as const satisfies readonly CopyOption[];

/** Playing speeds in RPM. */
export const VINYL_SPEEDS = [
  { value: '33⅓', label: '33⅓ RPM' },
  { value: '45', label: '45 RPM' },
  { value: '78', label: '78 RPM' },
] as const satisfies readonly CopyOption[];

/** Common record variants; any other color or finish can be typed. */
export const VINYL_VARIANTS = plain([
  'Black',
  'Colored',
  'Clear',
  'Splatter',
  'Marbled',
  'Picture Disc',
]);

/**
 * The Goldmine grades Discogs uses for a record's media and sleeve, best first. Stored as the code
 * (`VG+`), so a Discogs collection import (FC-31) maps one to one.
 */
export const CONDITION_GRADES = [
  { value: 'M', label: 'Mint (M)' },
  { value: 'NM', label: 'Near Mint (NM)' },
  { value: 'VG+', label: 'Very Good Plus (VG+)' },
  { value: 'VG', label: 'Very Good (VG)' },
  { value: 'G+', label: 'Good Plus (G+)' },
  { value: 'G', label: 'Good (G)' },
  { value: 'F', label: 'Fair (F)' },
  { value: 'P', label: 'Poor (P)' },
] as const satisfies readonly CopyOption[];

/** Sleeve grades: the media grades, plus Discogs' "Generic" and "No Cover". */
export const SLEEVE_GRADES = [
  ...CONDITION_GRADES,
  { value: 'Generic', label: 'Generic sleeve' },
  { value: 'No Cover', label: 'No cover' },
] as const satisfies readonly CopyOption[];

export type ConditionGrade = (typeof CONDITION_GRADES)[number]['value'];
export type SleeveGrade = (typeof SLEEVE_GRADES)[number]['value'];

// ---------------------------------------------------------------------------------------------------
// Video games (FC-11). The platform list comes from IGDB (`GET /api/platforms/igdb`).
// ---------------------------------------------------------------------------------------------------

/** Where a `Digital` or `Digital code` copy is (or is redeemed). */
export const GAME_STOREFRONTS = plain([
  'Steam',
  'Epic Games Store',
  'GOG',
  'PlayStation Store',
  'Xbox Store',
  'Nintendo eShop',
  'Battle.net',
  'EA app',
  'Ubisoft Connect',
  'itch.io',
]);

export const GAME_EDITIONS = plain(['Standard', 'Deluxe', 'GOTY', "Collector's"]);

/** Regions of a disc or cartridge. */
export const GAME_REGIONS = plain(['PAL', 'NTSC-U', 'NTSC-J', 'Region-free']);

/** How complete a physical copy is: still sealed, complete in box, or the disc / cartridge alone. */
export const GAME_COMPLETENESS = [
  { value: 'Sealed', label: 'Sealed' },
  { value: 'CIB', label: 'Complete in box (CIB)' },
  { value: 'Loose', label: 'Loose' },
] as const satisfies readonly CopyOption[];

/**
 * Languages offered for audio and subtitles, as ISO 639-1 codes. Any 2–3 letter ISO 639 code is
 * accepted; show them with `languageLabel`.
 */
export const LANGUAGE_CODES = [
  'en',
  'sr',
  'hr',
  'bs',
  'sl',
  'mk',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'is',
  'pl',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'tr',
  'ru',
  'uk',
  'ja',
  'ko',
  'zh',
  'hi',
  'ar',
  'he',
  'fa',
  'th',
  'vi',
  'id',
] as const;

/** The language's name in `locale`, e.g. `sr` → `Serbian`. Unknown codes are returned as they are. */
export function languageLabel(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language', fallback: 'code' }).of(code) ?? code;
  } catch {
    // Not a well-formed language code.
    return code;
  }
}
