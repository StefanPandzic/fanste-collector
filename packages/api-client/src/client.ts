import {
  apiErrorSchema,
  batchResponseSchema,
  itemResponseSchema,
  MAX_BATCH_ITEMS,
  MAX_MATCH_QUERIES,
  matchResponseSchema,
  platformListResponseSchema,
  searchResponseSchema,
} from '@fanste/core';

import type {
  ApiErrorCode,
  BatchResponse,
  ItemRef,
  MatchQuery,
  MatchResponse,
  MetadataProvider,
  NormalizedItem,
  PlatformListResponse,
  SearchQuery,
  SearchResponse,
} from '@fanste/core';
import type { z } from 'zod';

export interface ApiClientOptions {
  /**
   * Origin of the gateway, e.g. `https://collector.example.com`. Use `''` in the web app, which
   * calls its own origin with the session cookies.
   */
  baseUrl: string;
  /**
   * Returns the Supabase access token to send as `Authorization: Bearer`, for clients without the
   * session cookies (a future mobile app). Without it, requests rely on cookies.
   */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** `fetch` to use; defaults to the global one. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ApiClient {
  search(query: SearchQuery, options?: RequestOptions): Promise<SearchResponse>;
  getItem(ref: ItemRef, options?: RequestOptions): Promise<NormalizedItem>;
  /**
   * Loads an item from its provider again, skipping the cache TTL, and stores it in the shared cache.
   * Rate limited per user (`rate_limited`); an item refreshed moments ago comes from the cache.
   */
  refreshItem(ref: ItemRef, options?: RequestOptions): Promise<NormalizedItem>;
  /** Cached metadata of many items, in one request per `MAX_BATCH_ITEMS` refs. */
  getItemsBatch(refs: readonly ItemRef[], options?: RequestOptions): Promise<BatchResponse>;
  /** TMDB candidates per query, in query order; sent in chunks of `MAX_MATCH_QUERIES`. */
  matchTmdb(queries: readonly MatchQuery[], options?: RequestOptions): Promise<MatchResponse>;
  /** Every IGDB platform, for a game copy's platform field (FC-11). */
  getGamePlatforms(options?: RequestOptions): Promise<PlatformListResponse>;
}

/** A gateway error response, with the gateway's error `code`. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly provider?: MetadataProvider;
  /** From the `Retry-After` header of a `rate_limited` answer: how long to wait before retrying. */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    provider?: MetadataProvider,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.provider = provider;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Typed client for the API gateway (`apps/web/src/app/api/*`, FC-08). */
export function createApiClient({
  baseUrl,
  getAccessToken,
  fetch: fetchFn = (...args) => fetch(...args),
}: ApiClientOptions): ApiClient {
  const origin = baseUrl.replace(/\/+$/, '');

  async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
  ): Promise<z.output<S>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetchFn(`${origin}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
    const json: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        const { code, message, provider } = parsed.data.error;
        throw new ApiClientError(
          response.status,
          code,
          message,
          provider,
          retryAfterSeconds(response.headers.get('Retry-After')),
        );
      }
      throw new ApiClientError(response.status, 'internal', `HTTP ${response.status}`);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiClientError(response.status, 'internal', 'Unexpected response from the API.');
    }
    return parsed.data;
  }

  return {
    search({ category, q, page, year, format, country, code, platform }, options) {
      const params = new URLSearchParams({ category });
      if (q) params.set('q', q);
      if (page !== undefined) params.set('page', String(page));
      if (year !== undefined) params.set('year', String(year));
      if (format !== undefined) params.set('format', format);
      if (country !== undefined) params.set('country', country);
      if (code !== undefined) params.set('code', code);
      if (platform !== undefined) params.set('platform', String(platform));
      return request(`/api/search?${params.toString()}`, searchResponseSchema, {
        method: 'GET',
        signal: options?.signal,
      });
    },

    getItem(ref, options) {
      return request(itemPath(ref), itemResponseSchema, { method: 'GET', signal: options?.signal });
    },

    refreshItem(ref, options) {
      return request(`${itemPath(ref)}/refresh`, itemResponseSchema, {
        method: 'POST',
        signal: options?.signal,
      });
    },

    async getItemsBatch(refs, options) {
      const responses = await Promise.all(
        chunk(refs, MAX_BATCH_ITEMS).map((items) =>
          request('/api/items/batch', batchResponseSchema, {
            method: 'POST',
            body: { items },
            signal: options?.signal,
          }),
        ),
      );
      return {
        items: responses.flatMap((response) => response.items),
        missing: responses.flatMap((response) => response.missing),
      };
    },

    async matchTmdb(queries, options) {
      // Sequential, so the results stay in query order and the scanner doesn't burst.
      const results: MatchResponse['results'] = [];
      for (const part of chunk(queries, MAX_MATCH_QUERIES)) {
        const response = await request('/api/match/tmdb', matchResponseSchema, {
          method: 'POST',
          body: { queries: part },
          signal: options?.signal,
        });
        results.push(...response.results);
      }
      return { results };
    },

    getGamePlatforms(options) {
      return request('/api/platforms/igdb', platformListResponseSchema, {
        method: 'GET',
        signal: options?.signal,
      });
    },
  };
}

/** Seconds of a `Retry-After` header in its seconds form; the gateway never sends a date. */
function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null || !/^\d+$/.test(header.trim())) return undefined;
  return Number(header.trim());
}

/** `/api/items/:provider/:externalId`. */
function itemPath({ provider, externalId }: ItemRef): string {
  return `/api/items/${encodeURIComponent(provider)}/${encodeURIComponent(externalId)}`;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}
