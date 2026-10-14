import { z } from 'zod';

import {
  hasSearchTerm,
  MAX_SEARCH_QUERY_LENGTH,
  searchCodeSchema,
  searchCountrySchema,
  searchPlatformSchema,
} from './gateway/requests';
import { itemCategorySchema } from './models/enums';
import { MUSIC_SEARCH_FORMATS } from './models/formats';
import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './models/normalized-item';

// The user's recent searches (FC-17). Each app keeps the list in its own local storage; these helpers
// keep the list logic the same everywhere.

export const MAX_RECENT_SEARCHES = 8;

/** The fields of a recent search, each checked on its own (e.g. when read from a URL). */
export const recentSearchFields = z.object({
  category: itemCategorySchema,
  /** Empty for a music lookup by `code`. */
  q: z.string().trim().max(MAX_SEARCH_QUERY_LENGTH).default(''),
  year: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
  /** The music filters and lookup (FC-10). */
  format: z.enum(MUSIC_SEARCH_FORMATS).optional(),
  country: searchCountrySchema.optional(),
  code: searchCodeSchema.optional(),
  /** The game platform filter, an IGDB platform ID (FC-11). */
  platform: searchPlatformSchema.optional(),
});

/** A recent search: it has a query, or a music barcode / catalog number. */
export const recentSearchSchema = recentSearchFields.refine(hasSearchTerm);

export type RecentSearch = z.output<typeof recentSearchSchema>;

const lower = (value: string | undefined) => value?.toLowerCase();

/** Two searches are the same when every field matches (text ignoring case). */
function sameSearch(a: RecentSearch, b: RecentSearch): boolean {
  return (
    a.category === b.category &&
    a.q.toLowerCase() === b.q.toLowerCase() &&
    a.year === b.year &&
    a.format === b.format &&
    lower(a.country) === lower(b.country) &&
    lower(a.code) === lower(b.code) &&
    a.platform === b.platform
  );
}

/** Puts `entry` first, removing an earlier copy of it, and keeps at most `max` entries. */
export function addRecentSearch(
  list: readonly RecentSearch[],
  entry: RecentSearch,
  max = MAX_RECENT_SEARCHES,
): RecentSearch[] {
  const parsed = recentSearchSchema.safeParse(entry);
  if (!parsed.success) return list.slice(0, max);
  return [parsed.data, ...list.filter((other) => !sameSearch(other, parsed.data))].slice(0, max);
}

/** Removes one entry from the list. */
export function removeRecentSearch(
  list: readonly RecentSearch[],
  entry: RecentSearch,
): RecentSearch[] {
  return list.filter((other) => !sameSearch(other, entry));
}

/** Reads a stored list, dropping invalid entries instead of throwing. */
export function parseRecentSearches(value: unknown, max = MAX_RECENT_SEARCHES): RecentSearch[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const result = recentSearchSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    })
    .slice(0, max);
}
