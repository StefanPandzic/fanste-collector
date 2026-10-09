import { MAX_SEARCH_PAGE } from '@fanste/core';

import { GatewayError } from '../../errors';
import { gatewayLog } from '../../log';
import { providerFetch } from '../provider-fetch';
import { createImageConfigLoader } from './configuration';
import { mapMovie, mapMovieSearchResult, mapTv, mapTvSearchResult } from './mappers';
import {
  tmdbConfigurationSchema,
  tmdbMovieSchema,
  tmdbMovieSearchSchema,
  tmdbTvSchema,
  tmdbTvSearchSchema,
} from './schemas';

import type { ProviderAdapter } from '../types';
import type { TmdbImageConfig } from './configuration';
import type { TmdbKind } from './mappers';
import type {
  ItemCategory,
  MatchQuery,
  NormalizedItem,
  SearchResponse,
  SearchResult,
} from '@fanste/core';
import type { z } from 'zod';

const API_URL = 'https://api.themoviedb.org/3';

export const TMDB_DEFAULT_LANGUAGE = 'en-US';

/** Search results `matchCandidates` returns per title. */
export const MATCH_CANDIDATE_LIMIT = 5;

export interface TmdbAdapterOptions {
  /** API Read Access Token (v4 bearer), sent in the `Authorization` header. */
  token: string;
  /** Metadata language, e.g. `en-US` (the default). */
  language?: string;
}

/** A TMDB search result the scanner (FC-23) may match a file to, with what it scores on. */
export interface TmdbMatchCandidate {
  item: SearchResult;
  /** TMDB popularity, the tie-breaker between equally good titles. */
  popularity: number;
  /** The title in the original language, when TMDB has one. */
  originalTitle?: string;
}

/** Finds TMDB titles for a scanned file. FC-23 scores the candidates. */
export interface TmdbMatcher {
  /**
   * Up to `MATCH_CANDIDATE_LIMIT` search results for `title`, best TMDB match first. Searches with
   * `year` first and, when that finds nothing, again without it (file names often carry a wrong year).
   */
  matchCandidates(query: MatchQuery): Promise<TmdbMatchCandidate[]>;
  /** `matchCandidates` for a movie. */
  matchMovie(title: string, year?: number): Promise<TmdbMatchCandidate[]>;
}

export type TmdbAdapter = ProviderAdapter & TmdbMatcher;

function kindOf(category: ItemCategory): TmdbKind {
  if (category === 'movie' || category === 'tv') return category;
  throw new GatewayError('unsupported_category', `TMDB has no "${category}" items.`, {
    provider: 'tmdb',
  });
}

function toCandidate(
  item: SearchResult,
  popularity: number | null | undefined,
  original: string | null | undefined,
): TmdbMatchCandidate {
  const originalTitle = original?.trim();
  return { item, popularity: popularity ?? 0, ...(originalTitle ? { originalTitle } : {}) };
}

/** The numeric TMDB ID of `movie:603` / `tv:1396`, checked against `category`. */
function numericId(externalId: string, kind: TmdbKind): string {
  const match = /^(movie|tv):(\d+)$/.exec(externalId);
  if (match?.[1] !== kind || !match[2]) {
    throw new GatewayError('bad_request', 'Invalid external ID for this provider.');
  }
  return match[2];
}

/** The TMDB adapter (FC-09): movies and TV shows from The Movie Database API v3. */
export function createTmdbAdapter({
  token,
  language = TMDB_DEFAULT_LANGUAGE,
}: TmdbAdapterOptions): TmdbAdapter {
  async function get<S extends z.ZodType>(
    path: string,
    schema: S,
    params: Record<string, string | number | undefined> = {},
  ): Promise<z.output<S>> {
    const url = new URL(`${API_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await providerFetch('tmdb', url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const result = schema.safeParse(await response.json().catch(() => undefined));
    if (!result.success) {
      gatewayLog.error('tmdb.unexpected_response', { path }, result.error);
      throw new GatewayError('provider_error', 'tmdb sent an unexpected response.', {
        provider: 'tmdb',
      });
    }
    return result.data;
  }

  const imageConfig = createImageConfigLoader(async (): Promise<TmdbImageConfig> => {
    const { images } = await get('/configuration', tmdbConfigurationSchema);
    return { baseUrl: images.secure_base_url, posterSizes: images.poster_sizes };
  });

  /** One page of TMDB search results, with the popularity the matcher needs. */
  async function searchPage(kind: TmdbKind, q: string, page: number, year?: number) {
    const params = { query: q, page, include_adult: 'false', language };
    if (kind === 'movie') {
      const [images, data] = await Promise.all([
        imageConfig(),
        get('/search/movie', tmdbMovieSearchSchema, { ...params, year }),
      ]);
      const results = data.results.flatMap((result) => {
        const item = mapMovieSearchResult(result, images);
        return item ? [toCandidate(item, result.popularity, result.original_title)] : [];
      });
      return { data, results };
    }
    const [images, data] = await Promise.all([
      imageConfig(),
      get('/search/tv', tmdbTvSearchSchema, { ...params, first_air_date_year: year }),
    ]);
    const results = data.results.flatMap((result) => {
      const item = mapTvSearchResult(result, images);
      return item ? [toCandidate(item, result.popularity, result.original_name)] : [];
    });
    return { data, results };
  }

  async function getItem(kind: TmdbKind, id: string): Promise<NormalizedItem | undefined> {
    if (kind === 'movie') {
      const [images, movie] = await Promise.all([
        imageConfig(),
        get(`/movie/${id}`, tmdbMovieSchema, {
          append_to_response: 'credits,external_ids',
          language,
        }),
      ]);
      return mapMovie(movie, images);
    }
    // TV creators come with the show itself (`created_by`), so credits aren't needed.
    const [images, show] = await Promise.all([
      imageConfig(),
      get(`/tv/${id}`, tmdbTvSchema, { append_to_response: 'external_ids', language }),
    ]);
    return mapTv(show, images);
  }

  async function matchCandidates({ title, year, kind }: MatchQuery) {
    let { results } = await searchPage(kind, title, 1, year);
    if (results.length === 0 && year !== undefined)
      ({ results } = await searchPage(kind, title, 1));
    return results.slice(0, MATCH_CANDIDATE_LIMIT);
  }

  return {
    provider: 'tmdb',
    categories: ['movie', 'tv'],

    async search(q, { category, page, year }): Promise<SearchResponse> {
      const { data, results } = await searchPage(kindOf(category), q, page, year);
      return {
        results: results.map(({ item }) => item),
        page: data.page,
        // TMDB serves at most 500 pages, like the gateway allows.
        totalPages: Math.min(data.total_pages, MAX_SEARCH_PAGE),
        totalResults: data.total_results,
      };
    },

    async getById(externalId, category): Promise<NormalizedItem> {
      const kind = kindOf(category);
      const item = await getItem(kind, numericId(externalId, kind));
      if (!item) {
        throw new GatewayError('provider_error', 'tmdb sent an item without a title.', {
          provider: 'tmdb',
        });
      }
      return item;
    },

    matchCandidates,
    matchMovie: (title, year) =>
      matchCandidates({ title, kind: 'movie', ...(year !== undefined ? { year } : {}) }),
  };
}
