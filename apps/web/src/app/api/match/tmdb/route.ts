import { matchRequestSchema, matchResponseSchema } from '@fanste/core';

import { gatewayRoute, tmdbMatcher } from '@/server/gateway';
import { jsonOk, parseInput, readJson } from '@/server/http/responses';
import { matchTitles } from '@/server/match';

/**
 * `POST /api/match/tmdb` with `{ queries: [{ title, year?, kind }] }`: the best TMDB candidates for
 * each scanned title, scored by `scoreCandidates` (FC-23). The scanner sends its files in batches of
 * `MAX_MATCH_QUERIES`.
 */
export const POST = gatewayRoute('match.tmdb', async (request) => {
  const { queries } = parseInput(matchRequestSchema, await readJson(request));
  return jsonOk(matchResponseSchema, await matchTitles(tmdbMatcher, queries));
});
