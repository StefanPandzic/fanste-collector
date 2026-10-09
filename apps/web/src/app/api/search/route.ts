import { searchQuerySchema, searchResponseSchema } from '@fanste/core';

import { gatewayRoute, searchService } from '@/server/gateway';
import { jsonOk, parseInput } from '@/server/http/responses';
import { CACHE_CONTROL } from '@/server/limits';

/** `GET /api/search?category=&q=&page=`: one page of results from the category's provider. */
export const GET = gatewayRoute('search', async (request) => {
  const params = request.nextUrl.searchParams;
  const query = parseInput(searchQuerySchema, {
    category: params.get('category'),
    q: params.get('q'),
    page: params.get('page') ?? undefined,
  });
  const response = await searchService.search(query);
  return jsonOk(searchResponseSchema, response, CACHE_CONTROL.search);
});
