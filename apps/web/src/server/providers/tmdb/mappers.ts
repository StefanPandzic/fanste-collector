import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from '@fanste/core';

import { POSTER_SIZE, posterUrl, THUMBNAIL_SIZE } from './configuration';

import type { TmdbImageConfig } from './configuration';
import type { TmdbMovie, TmdbMovieSearchResult, TmdbTv, TmdbTvSearchResult } from './schemas';
import type { MovieExtra, NormalizedItem, SearchResult, TvExtra, TvSeason } from '@fanste/core';

// TMDB payloads → `NormalizedItem` / `SearchResult` (FC-09). TMDB uses `null` and `""` for unknown
// values; they become missing fields, so the results pass the strict core schemas.

export type TmdbKind = 'movie' | 'tv';

const SITE_URL = 'https://www.themoviedb.org';

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** The year of a TMDB date (`2010-07-15`). */
export function yearOf(date: string | null | undefined): number | undefined {
  const match = /^(\d{4})-/.exec(date ?? '');
  const year = match ? Number(match[1]) : undefined;
  return year !== undefined && year >= MIN_RELEASE_YEAR && year <= MAX_RELEASE_YEAR
    ? year
    : undefined;
}

/** A positive whole number, or `undefined` (TMDB uses `0` / `null` for "unknown"). */
function positive(value: number | null | undefined): number | undefined {
  return value !== null && value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function count(value: number | null | undefined): number | undefined {
  return value !== null && value !== undefined && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function imdbId(...values: (string | null | undefined)[]): string | undefined {
  return values.find((value): value is string => /^tt\d+$/.test(value ?? ''));
}

/** Unique, non-empty names. */
function names(list: readonly { name?: string | null }[] | null | undefined): string[] | undefined {
  const unique = [...new Set((list ?? []).flatMap((entry) => text(entry.name) ?? []))];
  return unique.length > 0 ? unique : undefined;
}

/** Drops `undefined` fields; `undefined` when nothing is left. */
function compact<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, field]) => field !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/** An ISO 639-1 code; TMDB's `xx` ("no language") and other values become `undefined`. */
function languageCode(value: string | null | undefined): string | undefined {
  const code = text(value)?.toLowerCase();
  return code && /^[a-z]{2}$/.test(code) && code !== 'xx' ? code : undefined;
}

/** The original title, only when it differs from the (localized) title. */
function originalTitle(original: string | null | undefined, title: string): string | undefined {
  const value = text(original);
  return value && value !== title ? value : undefined;
}

export function tmdbExternalId(kind: TmdbKind, id: number): string {
  return `${kind}:${id}`;
}

export function tmdbSourceUrl(kind: TmdbKind, id: number): string {
  return `${SITE_URL}/${kind}/${id}`;
}

/** A search result for a list, or `undefined` when TMDB sent it without a title. */
export function mapMovieSearchResult(
  result: TmdbMovieSearchResult,
  images: TmdbImageConfig,
): SearchResult | undefined {
  const title = text(result.title) ?? text(result.original_title);
  if (!title) return undefined;
  return {
    provider: 'tmdb',
    externalId: tmdbExternalId('movie', result.id),
    category: 'movie',
    title,
    releaseYear: yearOf(result.release_date),
    thumbnailUrl: posterUrl(images, result.poster_path, THUMBNAIL_SIZE),
  };
}

/** A search result for a list, or `undefined` when TMDB sent it without a name. */
export function mapTvSearchResult(
  result: TmdbTvSearchResult,
  images: TmdbImageConfig,
): SearchResult | undefined {
  const title = text(result.name) ?? text(result.original_name);
  if (!title) return undefined;
  return {
    provider: 'tmdb',
    externalId: tmdbExternalId('tv', result.id),
    category: 'tv',
    title,
    releaseYear: yearOf(result.first_air_date),
    thumbnailUrl: posterUrl(images, result.poster_path, THUMBNAIL_SIZE),
  };
}

/** `/movie/{id}` with credits and external IDs. Directors become `creators`. */
export function mapMovie(movie: TmdbMovie, images: TmdbImageConfig): NormalizedItem | undefined {
  const title = text(movie.title) ?? text(movie.original_title);
  if (!title) return undefined;
  const directors = (movie.credits?.crew ?? []).filter((member) => member.job === 'Director');
  const extra = compact<MovieExtra>({
    runtimeMinutes: positive(movie.runtime),
    imdbId: imdbId(movie.imdb_id, movie.external_ids?.imdb_id),
    originalTitle: originalTitle(movie.original_title, title),
    tagline: text(movie.tagline),
    originalLanguage: languageCode(movie.original_language),
  });
  return {
    provider: 'tmdb',
    externalId: tmdbExternalId('movie', movie.id),
    category: 'movie',
    title,
    releaseYear: yearOf(movie.release_date),
    imageUrl: posterUrl(images, movie.poster_path, POSTER_SIZE),
    thumbnailUrl: posterUrl(images, movie.poster_path, THUMBNAIL_SIZE),
    description: text(movie.overview),
    genres: names(movie.genres),
    creators: names(directors),
    extra,
    sourceUrl: tmdbSourceUrl('movie', movie.id),
  };
}

/** `/tv/{id}` with external IDs. Creators become `creators`, the first network the `subtitle`. */
export function mapTv(show: TmdbTv, images: TmdbImageConfig): NormalizedItem | undefined {
  const title = text(show.name) ?? text(show.original_name);
  if (!title) return undefined;
  const networks = names(show.networks);
  const seasons = (show.seasons ?? []).flatMap((season): TvSeason[] => {
    const seasonNumber = count(season.season_number);
    if (seasonNumber === undefined) return [];
    const mapped = compact<TvSeason>({
      seasonNumber,
      name: text(season.name),
      episodeCount: count(season.episode_count),
      airYear: yearOf(season.air_date),
    });
    return mapped ? [mapped] : [];
  });
  const extra = compact<TvExtra>({
    imdbId: imdbId(show.external_ids?.imdb_id),
    originalTitle: originalTitle(show.original_name, title),
    originalLanguage: languageCode(show.original_language),
    status: text(show.status),
    seasonCount: count(show.number_of_seasons),
    episodeCount: count(show.number_of_episodes),
    episodeRuntimeMinutes: positive(show.episode_run_time?.[0]),
    networks,
    seasons: seasons.length > 0 ? seasons : undefined,
  });
  return {
    provider: 'tmdb',
    externalId: tmdbExternalId('tv', show.id),
    category: 'tv',
    title,
    subtitle: networks?.[0],
    releaseYear: yearOf(show.first_air_date),
    imageUrl: posterUrl(images, show.poster_path, POSTER_SIZE),
    thumbnailUrl: posterUrl(images, show.poster_path, THUMBNAIL_SIZE),
    description: text(show.overview),
    genres: names(show.genres),
    creators: names(show.created_by),
    extra,
    sourceUrl: tmdbSourceUrl('tv', show.id),
  };
}
