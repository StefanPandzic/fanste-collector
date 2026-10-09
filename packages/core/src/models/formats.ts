import type { ItemCategory } from './enums';

/**
 * Media offered for movies and TV (`collection_items.format`). The field is free text, so the UI also
 * accepts an "Other" value. Copy details (resolution, HDR, edition, ...) are defined in FC-15.
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

/**
 * Media offered per category. Movies & TV ship first; the other lists are filled in by their
 * provider tasks: music FC-10, video games FC-11, board games FC-12, Funko FC-13.
 */
export const FORMATS_BY_CATEGORY: Record<ItemCategory, readonly string[]> = {
  movie: MOVIE_TV_FORMATS,
  tv: MOVIE_TV_FORMATS,
  music: [],
  video_game: [],
  board_game: [],
  funko: [],
};
