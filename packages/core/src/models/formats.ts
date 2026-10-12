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
 * Media offered per category. The other lists are filled in by their provider tasks: video games
 * FC-11, board games FC-12, Funko FC-13.
 */
export const FORMATS_BY_CATEGORY: Record<ItemCategory, readonly string[]> = {
  movie: MOVIE_TV_FORMATS,
  tv: MOVIE_TV_FORMATS,
  music: MUSIC_FORMATS,
  video_game: [],
  board_game: [],
  funko: [],
};
