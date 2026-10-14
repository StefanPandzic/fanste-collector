import {
  hasSearchTerm,
  MAX_RELEASE_YEAR,
  MIN_RELEASE_YEAR,
  POPULAR_GAME_PLATFORMS,
  recentSearchFields,
} from '@fanste/core';

import type { ItemCardData } from '@/components/items/item-card';

import type { SearchRequest } from './use-search-results';
import type {
  GamePlatform,
  ItemCategory,
  MusicSearchFormat,
  SearchResponse,
  SearchResult,
} from '@fanste/core';
import type { z } from 'zod';

/**
 * Categories whose provider is built. Board games come with FC-12; Funko Pops have no provider and
 * are added by hand (FC-13).
 */
export const SEARCHABLE_CATEGORIES: readonly ItemCategory[] = [
  'movie',
  'tv',
  'music',
  'video_game',
];

export function isSearchable(category: ItemCategory): boolean {
  return SEARCHABLE_CATEGORIES.includes(category);
}

/**
 * What the search page shows, kept in the URL
 * (`/search?category=&q=&year=&format=&country=&code=&platform=`).
 */
export interface SearchState {
  category: ItemCategory;
  /** As typed; trimmed before searching. */
  q: string;
  year?: number;
  /** The music filters and lookup (FC-10); only kept for music. */
  format?: MusicSearchFormat;
  /** Release country, as typed. */
  country?: string;
  /** Barcode or catalog number, as typed. */
  code?: string;
  /** The game platform filter (FC-11), an IGDB platform ID; only kept for video games. */
  platform?: number;
}

export const DEFAULT_SEARCH_STATE: SearchState = { category: 'movie', q: '' };

/**
 * Release countries offered in the music search's Country field, as Discogs names them. Any other
 * Discogs country can be typed.
 */
export const COUNTRY_SUGGESTIONS = [
  'US',
  'UK',
  'Europe',
  'UK & Europe',
  'Germany',
  'France',
  'Italy',
  'Netherlands',
  'Spain',
  'Sweden',
  'Japan',
  'Canada',
  'Australia',
  'Brazil',
  'Yugoslavia',
  'Serbia',
  'Croatia',
  'Poland',
  'USSR',
  'Russia',
  'Worldwide',
] as const;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `value` if `schema` accepts it, else `undefined`. */
function valid<T extends z.ZodType>(schema: T, value: unknown): z.output<T> | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Reads the page's search params. Each is checked on its own, so an invalid or unsearchable value
 * falls back to its default without dropping the others.
 */
export function parseSearchState(params: RawParams): SearchState {
  const fields = recentSearchFields.shape;
  const state: SearchState = { ...DEFAULT_SEARCH_STATE };
  const category = valid(fields.category, first(params.category));
  if (category && isSearchable(category)) state.category = category;
  const q = valid(fields.q, first(params.q));
  if (q) state.q = q;
  const year = valid(fields.year, Number(first(params.year)));
  if (year !== undefined) state.year = year;
  if (state.category === 'music') {
    const format = valid(fields.format, first(params.format));
    if (format) state.format = format;
    const country = valid(fields.country, first(params.country));
    if (country) state.country = country;
    const code = valid(fields.code, first(params.code));
    if (code) state.code = code;
  }
  if (state.category === 'video_game') {
    const platform = valid(fields.platform, Number(first(params.platform)));
    if (platform !== undefined) state.platform = platform;
  }
  return state;
}

/** The URL of a search state, e.g. `/search?category=tv&q=lost`. */
export function searchStateUrl({
  category,
  q,
  year,
  format,
  country,
  code,
  platform,
}: SearchState): string {
  const params = new URLSearchParams({ category });
  if (q.trim()) params.set('q', q.trim());
  if (year !== undefined) params.set('year', String(year));
  if (category === 'music') {
    if (format) params.set('format', format);
    if (country?.trim()) params.set('country', country.trim());
    if (code?.trim()) params.set('code', code.trim());
  }
  if (category === 'video_game' && platform !== undefined) params.set('platform', String(platform));
  return `/search?${params.toString()}`;
}

/**
 * The search to run for the state, with the debounced text fields; `null` while there is nothing
 * to search for. The music filters and lookup only apply to music, the platform to video games.
 */
export function searchRequestOf(
  state: Pick<SearchState, 'category' | 'year' | 'format' | 'platform'>,
  typed: { q: string; country?: string; code?: string },
): SearchRequest | null {
  const music = state.category === 'music';
  const country = music ? typed.country?.trim() : undefined;
  const code = music ? typed.code?.trim() : undefined;
  const request: SearchRequest = {
    category: state.category,
    q: typed.q.trim(),
    ...(state.year !== undefined ? { year: state.year } : {}),
    ...(music && state.format ? { format: state.format } : {}),
    ...(country ? { country } : {}),
    ...(code ? { code } : {}),
    ...(state.category === 'video_game' && state.platform !== undefined
      ? { platform: state.platform }
      : {}),
  };
  return hasSearchTerm(request) ? request : null;
}

/**
 * How a game platform filter is shown: the short label of a popular platform (`PS5`), else its IGDB
 * name from `platforms`, else a generic text while the list loads.
 */
export function searchPlatformLabel(id: number, platforms?: readonly GamePlatform[]): string {
  return (
    POPULAR_GAME_PLATFORMS.find((platform) => platform.id === id)?.label ??
    platforms?.find((platform) => platform.id === id)?.name ??
    'the chosen platform'
  );
}

/**
 * What a search looked for, for the "No results" text: e.g. `matching “Bad” on Vinyl from UK`,
 * `matching “Zelda” on Switch` or `with barcode or catalog number “EPC 450290 1”`.
 */
export function searchDescription(
  request: SearchRequest,
  platforms?: readonly GamePlatform[],
): string {
  const parts = [];
  if (request.q) parts.push(`matching “${request.q}”`);
  if (request.code) parts.push(`with barcode or catalog number “${request.code}”`);
  if (request.format) parts.push(`on ${request.format}`);
  if (request.platform !== undefined) {
    parts.push(`on ${searchPlatformLabel(request.platform, platforms)}`);
  }
  if (request.country) parts.push(`from ${request.country}`);
  if (request.year) parts.push(`released in ${request.year}`);
  return parts.join(' ');
}

/**
 * A search result as a card. A record shows its artist, and its pressing (`detail`) as badges, so
 * pressings of the same album can be told apart; a game shows its developer and platforms (FC-11).
 * The grid gives these cards the badge line's height.
 */
export function resultCardData(result: SearchResult): ItemCardData {
  const { subtitle, detail, ...card } = result;
  if (result.category !== 'music' && result.category !== 'video_game') return card;
  return {
    ...card,
    ...(subtitle ? { subtitle } : {}),
    badges: detail ? detail.split(' · ') : [],
  };
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
