import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR, recentSearchSchema } from '@fanste/core';

import type { ItemCategory, SearchResponse, SearchResult } from '@fanste/core';

/**
 * Categories whose provider is built. Music comes with FC-10, video games with FC-11, board games
 * with FC-12; Funko Pops have no provider and are added by hand (FC-13).
 */
export const SEARCHABLE_CATEGORIES: readonly ItemCategory[] = ['movie', 'tv'];

export function isSearchable(category: ItemCategory): boolean {
  return SEARCHABLE_CATEGORIES.includes(category);
}

/** What the search page shows, kept in the URL (`/search?category=&q=&year=`). */
export interface SearchState {
  category: ItemCategory;
  /** As typed; trimmed before searching. */
  q: string;
  year?: number;
}

export const DEFAULT_SEARCH_STATE: SearchState = { category: 'movie', q: '' };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the page's search params; invalid or unsearchable values fall back to the defaults. */
export function parseSearchState(params: RawParams): SearchState {
  const category = first(params.category);
  const q = first(params.q)?.trim() ?? '';
  const year = Number(first(params.year));
  const parsed = recentSearchSchema.partial().safeParse({
    category,
    q: q || undefined,
    year: Number.isInteger(year) && year > 0 ? year : undefined,
  });
  const state: SearchState = { ...DEFAULT_SEARCH_STATE };
  if (!parsed.success) return state;
  if (parsed.data.category && isSearchable(parsed.data.category)) {
    state.category = parsed.data.category;
  }
  if (parsed.data.q) state.q = parsed.data.q;
  if (parsed.data.year !== undefined) state.year = parsed.data.year;
  return state;
}

/** The URL of a search state, e.g. `/search?category=tv&q=lost`. */
export function searchStateUrl({ category, q, year }: SearchState): string {
  const params = new URLSearchParams({ category });
  if (q.trim()) params.set('q', q.trim());
  if (year !== undefined) params.set('year', String(year));
  return `/search?${params.toString()}`;
}

/** Reads the year filter input: a whole year, or `undefined` while empty or incomplete. */
export function parseYearInput(value: string): number | undefined {
  if (!/^\d{4}$/.test(value.trim())) return undefined;
  const year = Number(value.trim());
  return year >= MIN_RELEASE_YEAR && year <= MAX_RELEASE_YEAR ? year : undefined;
}

/**
 * The results of all loaded pages, in order. Popularity can shift between page loads, so an item may
 * come back on a later page; only its first appearance is kept.
 */
export function flattenResults(pages: readonly SearchResponse[]): SearchResult[] {
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const page of pages) {
    for (const result of page.results) {
      const key = `${result.provider}:${result.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
    }
  }
  return results;
}
