import type { ItemCategory } from './enums';

/**
 * Media offered for movies and TV (`collection_items.format`). The field is free text, so the UI also
 * accepts an "Other" value. Copy details (resolution, HDR, edition, ...) are in `copy-details.ts`.
 */
export const MOVIE_TV_FORMATS = [
  'DVD',
  'Blu-ray',
  '4K UHD Blu-ray',
  'VHS',
  'Digital file',
  'Digital store',
] as const;

export type MovieTvFormat = (typeof MOVIE_TV_FORMATS)[number];

/** Media offered for music (FC-10). Vinyl details (size, speed, variant) apply to `Vinyl` only. */
export const MUSIC_FORMATS = ['Vinyl', 'CD', 'Cassette', 'Digital'] as const;

export type MusicFormat = (typeof MUSIC_FORMATS)[number];

/** The physical media a Discogs search can be narrowed to (`format=` of `/database/search`). */
export const MUSIC_SEARCH_FORMATS = ['Vinyl', 'CD', 'Cassette'] as const;

export type MusicSearchFormat = (typeof MUSIC_SEARCH_FORMATS)[number];

/**
 * Media offered for video games (FC-11). The storefront applies to the digital media, the region and
 * completeness to the physical ones.
 */
export const VIDEO_GAME_FORMATS = ['Disc', 'Cartridge', 'Digital', 'Digital code'] as const;

export type VideoGameFormat = (typeof VIDEO_GAME_FORMATS)[number];

/**
 * Platforms offered as one-click filters of a game search (FC-11), by IGDB platform ID. Any other
 * IGDB platform can be picked from the full list (`GET /api/platforms/igdb`).
 */
export const POPULAR_GAME_PLATFORMS = [
  { id: 6, name: 'PC (Microsoft Windows)', label: 'PC' },
  { id: 167, name: 'PlayStation 5', label: 'PS5' },
  { id: 48, name: 'PlayStation 4', label: 'PS4' },
  { id: 169, name: 'Xbox Series X|S', label: 'Xbox Series X|S' },
  { id: 49, name: 'Xbox One', label: 'Xbox One' },
  { id: 508, name: 'Nintendo Switch 2', label: 'Switch 2' },
  { id: 130, name: 'Nintendo Switch', label: 'Switch' },
] as const;

/** Media offered for the items of custom collections (FC-13). */
export const CUSTOM_FORMATS = ['Physical', 'Digital'] as const;

export type CustomFormat = (typeof CUSTOM_FORMATS)[number];

/** Media offered per category. Board games get their list with FC-12. */
export const FORMATS_BY_CATEGORY: Record<ItemCategory, readonly string[]> = {
  movie: MOVIE_TV_FORMATS,
  tv: MOVIE_TV_FORMATS,
  music: MUSIC_FORMATS,
  video_game: VIDEO_GAME_FORMATS,
  board_game: [],
  custom: CUSTOM_FORMATS,
};
