import { batchRequestSchema, batchResponseSchema } from '@fanste/core';

import { gatewayRoute, itemService } from '@/server/gateway';
import { jsonOk, parseInput, readJson } from '@/server/http/responses';

/**
 * `POST /api/items/batch` with `{ items: [{ provider, externalId }] }`: the cached metadata of many
 * items at once (a gallery page). Only cache misses go to the providers.
 */
export const POST = gatewayRoute('items.batch', async (request) => {
  const { items } = parseInput(batchRequestSchema, await readJson(request));
  const response = await itemService().getItemsBatch(items);
  return jsonOk(batchResponseSchema, response);
});
