import { matchRequestSchema } from '@fanste/core';

import { GatewayError } from '@/server/errors';
import { gatewayRoute } from '@/server/gateway';
import { parseInput, readJson } from '@/server/http/responses';

/**
 * `POST /api/match/tmdb` with `{ queries: [{ title, year?, kind }] }`: the best TMDB candidates for
 * each scanned title, with a confidence (`matchResponseSchema`). Needs the TMDB adapter (FC-09).
 */
export const POST = gatewayRoute('match.tmdb', async (request) => {
  parseInput(matchRequestSchema, await readJson(request));
  throw new GatewayError('not_implemented', 'TMDB matching is not available yet (FC-23).', {
    provider: 'tmdb',
  });
});
