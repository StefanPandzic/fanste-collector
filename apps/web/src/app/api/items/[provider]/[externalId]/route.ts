import { itemRefSchema, itemResponseSchema } from '@fanste/core';

import { gatewayRoute, itemService } from '@/server/gateway';
import { jsonOk, parseInput } from '@/server/http/responses';
import { CACHE_CONTROL } from '@/server/limits';

/** `GET /api/items/:provider/:externalId`: the full normalized item, from the cache when possible. */
export const GET = gatewayRoute(
  'items.get',
  async (
    _request,
    { context }: { context: RouteContext<'/api/items/[provider]/[externalId]'> },
  ) => {
    const ref = parseInput(itemRefSchema, await context.params);
    const item = await itemService().getItem(ref);
    return jsonOk(itemResponseSchema, item, CACHE_CONTROL.item);
  },
);
