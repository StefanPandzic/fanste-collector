// Wires the gateway's services for the Route Handlers in `app/api/*`. Uses the secret key.
import 'server-only';

import { after } from 'next/server';

import { serverEnv } from '@/env/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

import { createLruCache } from './cache/lru';
import { createSupabaseMetadataCache } from './cache/metadata-cache';
import { authenticateRequest } from './http/authenticate';
import { createGatewayRoute } from './http/handler';
import { createItemService } from './items';
import { IMAGE_PROXY, REFRESH_LIMITS, SEARCH_CACHE, USER_RATE_LIMIT } from './limits';
import { createDiscogsAdapter, discogsUserAgent } from './providers/discogs/adapter';
import { createIgdbAdapter } from './providers/igdb/adapter';
import { createRegistry } from './providers/registry';
import { createTmdbAdapter } from './providers/tmdb/adapter';
import { createUserLimiter } from './rate-limit/user-limiter';
import { createSearchService } from './search';

import type { ItemService } from './items';
import type { IgdbPlatforms } from './providers/igdb/adapter';
import type { TmdbMatcher } from './providers/tmdb/adapter';
import type { SearchResponse } from '@fanste/core';

const tmdb = serverEnv.TMDB_API_READ_TOKEN
  ? createTmdbAdapter({
      token: serverEnv.TMDB_API_READ_TOKEN,
      language: serverEnv.TMDB_LANGUAGE,
    })
  : undefined;

const discogs =
  serverEnv.DISCOGS_CONSUMER_KEY && serverEnv.DISCOGS_CONSUMER_SECRET
    ? createDiscogsAdapter({
        consumerKey: serverEnv.DISCOGS_CONSUMER_KEY,
        consumerSecret: serverEnv.DISCOGS_CONSUMER_SECRET,
        contactUrl: serverEnv.DISCOGS_USER_AGENT_URL,
      })
    : undefined;

const igdb =
  serverEnv.TWITCH_CLIENT_ID && serverEnv.TWITCH_CLIENT_SECRET
    ? createIgdbAdapter({
        clientId: serverEnv.TWITCH_CLIENT_ID,
        clientSecret: serverEnv.TWITCH_CLIENT_SECRET,
      })
    : undefined;

/**
 * The provider adapters. Each integration task registers its adapter here: TMDB (FC-09), Discogs
 * (FC-10), IGDB (FC-11) and BGG (FC-12). A provider without an adapter (not built yet, or its secret
 * isn't set) answers `provider_not_configured` for its categories.
 */
const registry = createRegistry([tmdb, discogs, igdb].filter((adapter) => adapter !== undefined));

/** TMDB title matching for the scanner (FC-23); `undefined` when TMDB isn't configured. */
export const tmdbMatcher: TmdbMatcher | undefined = tmdb;

/** The IGDB platform list (FC-11); `undefined` when IGDB isn't configured. */
export const igdbPlatforms: IgdbPlatforms | undefined = igdb;

// Per-instance state, shared by the requests this instance serves.
export const gatewayRoute = createGatewayRoute({
  authenticate: authenticateRequest,
  userLimiter: createUserLimiter(USER_RATE_LIMIT),
});

/** `GET /api/image` (FC-26), with its own per-user limit (`IMAGE_PROXY`) instead of the API's. */
export const imageRoute = createGatewayRoute({
  authenticate: authenticateRequest,
  userLimiter: createUserLimiter(IMAGE_PROXY.perUser),
});

/** The `User-Agent` of proxied image requests; Discogs requires one. */
export const imageProxyUserAgent = discogsUserAgent(serverEnv.DISCOGS_USER_AGENT_URL);

/** The extra per-user limit of "Refresh metadata" (`REFRESH_LIMITS`). */
export const refreshLimiter = createUserLimiter(REFRESH_LIMITS.perUser);

export const searchService = createSearchService({
  registry,
  cache: createLruCache<SearchResponse>(SEARCH_CACHE),
});

/** The item service for one request (the service client reads the env on creation). */
export function itemService(): ItemService {
  return createItemService({
    registry,
    cache: createSupabaseMetadataCache(createSupabaseServiceClient()),
    runInBackground: (task) => after(task),
  });
}
