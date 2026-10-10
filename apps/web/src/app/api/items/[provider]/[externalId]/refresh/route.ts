import { itemRefSchema, itemResponseSchema } from '@fanste/core';

import { GatewayError } from '@/server/errors';
import { gatewayRoute, itemService, refreshLimiter } from '@/server/gateway';
import { jsonOk, parseInput } from '@/server/http/responses';
import { CACHE_CONTROL } from '@/server/limits';

/**
 * `POST /api/items/:provider/:externalId/refresh`: "Refresh metadata" (FC-19). Loads the item from
 * its provider whatever the cache TTL and stores it in `metadata_cache`. Rate limited per user and
 * per item (`REFRESH_LIMITS`).
 */
export const POST = gatewayRoute(
  'items.refresh',
  async (
    _request,
    {
      userId,
      context,
    }: { userId: string; context: RouteContext<'/api/items/[provider]/[externalId]/refresh'> },
  ) => {
    const ref = parseInput(itemRefSchema, await context.params);
    const limit = refreshLimiter.check(userId);
    if (!limit.allowed) {
      throw new GatewayError('rate_limited', 'Too many refreshes. Try again later.', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const item = await itemService().refreshItem(ref);
    return jsonOk(itemResponseSchema, item, CACHE_CONTROL.noStore);
  },
);
