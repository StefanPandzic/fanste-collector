import type { ExternalProvider } from '@fanste/core';

// Every limit and TTL of the API gateway, in one place (FC-08). Serverless instances don't share
// memory, so the in-memory limits apply per instance (best effort); `metadata_cache` is the cache
// all instances share.

export interface ProviderLimits {
  /** Outbound requests per second (token bucket refill rate). */
  ratePerSecond: number;
  /** Requests that may start at once before waiting for the bucket to refill. */
  burst: number;
  /** Requests in flight at the same time. */
  maxConcurrent: number;
  /**
   * Requests that may wait for the throttle (about 15 s worth). Beyond it a request fails at once
   * with `provider_error` instead of making every other user wait.
   */
  maxQueue: number;
  /**
   * Cache misses (and background refreshes) one request may send to the provider. A batch reports
   * the rest in `missing`, and the client asks for them again later.
   */
  maxFetchesPerRequest: number;
  /** How long a `metadata_cache` row is fresh; a stale row is served and refreshed in the background. */
  cacheTtlMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Conservative limits, below what each provider allows (FC-09 – FC-12 document the real ones). */
export const PROVIDER_LIMITS: Record<ExternalProvider, ProviderLimits> = {
  // ~50 req/s allowed.
  tmdb: {
    ratePerSecond: 20,
    burst: 20,
    maxConcurrent: 10,
    maxQueue: 300,
    maxFetchesPerRequest: 20,
    cacheTtlMs: 30 * DAY_MS,
  },
  // 60 req/min with a token.
  discogs: {
    ratePerSecond: 1,
    burst: 2,
    maxConcurrent: 2,
    maxQueue: 15,
    maxFetchesPerRequest: 5,
    cacheTtlMs: 30 * DAY_MS,
  },
  // 4 req/s, at most 8 open requests.
  igdb: {
    ratePerSecond: 4,
    burst: 4,
    maxConcurrent: 4,
    maxQueue: 60,
    maxFetchesPerRequest: 10,
    cacheTtlMs: 30 * DAY_MS,
  },
  // No published limit; BGG blocks clients that go faster than about one request every 2 s.
  bgg: {
    ratePerSecond: 0.5,
    burst: 1,
    maxConcurrent: 1,
    maxQueue: 8,
    maxFetchesPerRequest: 3,
    cacheTtlMs: 30 * DAY_MS,
  },
};

/** Retries of a provider request that got HTTP 429 or 503. */
export const PROVIDER_RETRY = {
  maxRetries: 3,
  baseDelayMs: 500,
  /** Longest single wait; a longer `Retry-After` makes the request fail instead. */
  maxDelayMs: 10_000,
  /** Per-attempt timeout. */
  timeoutMs: 10_000,
};

/** Requests per user to the gateway, to protect our provider quota. */
export const USER_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/** Per-instance search result cache. */
export const SEARCH_CACHE = { maxEntries: 500, ttlMs: 10 * 60_000 };

/** `Cache-Control` of successful responses. They are per user, so only the browser may cache them. */
export const CACHE_CONTROL = {
  search: 'private, max-age=300',
  item: 'private, max-age=3600',
  noStore: 'no-store',
};
