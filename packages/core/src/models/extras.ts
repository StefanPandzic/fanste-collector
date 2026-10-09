import { z } from 'zod';

import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './normalized-item';

// Category-specific `NormalizedItem.extra` fields. `extra` is a loose record, so read it through the
// category's parser: it returns `undefined` when the data doesn't match, instead of throwing.

const text = z.string().trim().min(1);
const count = z.int().min(0);
/** IMDb title ID, e.g. `tt1375666`. */
const imdbId = z.string().regex(/^tt\d+$/);

export const movieExtraSchema = z.object({
  runtimeMinutes: count.optional(),
  imdbId: imdbId.optional(),
  /** Title in the original language, when it differs from `title`. */
  originalTitle: text.optional(),
  tagline: text.optional(),
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
  /** Provider status, e.g. `Returning Series`, `Ended`, `Canceled`. */
  status: text.optional(),
  seasonCount: count.optional(),
  episodeCount: count.optional(),
  episodeRuntimeMinutes: count.optional(),
  networks: z.array(text).optional(),
  /** Offered as the `seasonsOwned` options of the copy details (FC-15). */
  seasons: z.array(tvSeasonSchema).optional(),
});

export type TvExtra = z.output<typeof tvExtraSchema>;

// Not defined yet: Movies & TV ship first. Until then these categories keep the loose `extra` record.
// MusicExtra: FC-10. VideoGameExtra: FC-11. BoardGameExtra: FC-12. FunkoExtra: FC-13.

export function parseMovieExtra(extra: unknown): MovieExtra | undefined {
  const result = movieExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}

export function parseTvExtra(extra: unknown): TvExtra | undefined {
  const result = tvExtraSchema.safeParse(extra);
  return result.success ? result.data : undefined;
}
