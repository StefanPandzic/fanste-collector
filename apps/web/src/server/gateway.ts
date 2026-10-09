// Wires the gateway's services for the Route Handlers in `app/api/*`. Uses the secret key.
import 'server-only';

import { after } from 'next/server';

import { createSupabaseServiceClient } from '@/lib/supabase/service';

import { createLruCache } from './cache/lru';
import { createSupabaseMetadataCache } from './cache/metadata-cache';
import { authenticateRequest } from './http/authenticate';
import { createGatewayRoute } from './http/handler';
import { createItemService } from './items';
import { SEARCH_CACHE, USER_RATE_LIMIT } from './limits';
import { createRegistry } from './providers/registry';
import { createUserLimiter } from './rate-limit/user-limiter';
import { createSearchService } from './search';

import type { ItemService } from './items';
import type { SearchResponse } from '@fanste/core';

/**
 * The provider adapters. Each integration task registers its adapter here: TMDB (FC-09), Discogs
 * (FC-10), IGDB (FC-11) and BGG (FC-12). Until then its categories answer `provider_not_configured`.
 */
const registry = createRegistry([]);

// Per-instance state, shared by the requests this instance serves.
export const gatewayRoute = createGatewayRoute({
  authenticate: authenticateRequest,
  userLimiter: createUserLimiter(USER_RATE_LIMIT),
});

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
