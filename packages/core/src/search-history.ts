import { z } from 'zod';

import { MAX_SEARCH_QUERY_LENGTH } from './gateway/requests';
import { itemCategorySchema } from './models/enums';
import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './models/normalized-item';

// The user's recent searches (FC-17). Each app keeps the list in its own local storage; these helpers
// keep the list logic the same everywhere.

export const MAX_RECENT_SEARCHES = 8;

export const recentSearchSchema = z.object({
  category: itemCategorySchema,
  q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
  year: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
});

export type RecentSearch = z.output<typeof recentSearchSchema>;

/** Two searches are the same when category, query (ignoring case) and year match. */
function sameSearch(a: RecentSearch, b: RecentSearch): boolean {
  return a.category === b.category && a.q.toLowerCase() === b.q.toLowerCase() && a.year === b.year;
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
