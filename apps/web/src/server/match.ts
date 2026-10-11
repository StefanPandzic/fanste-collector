import { normalizeTitle, scoreCandidates } from '@fanste/core';

import { GatewayError } from './errors';
import { gatewayLog } from './log';

import type { TmdbMatcher } from './providers/tmdb/adapter';
import type { MatchQuery, MatchResponse } from '@fanste/core';

/** TMDB searches one match request runs at once, so a batch doesn't fill the provider queue. */
export const MATCH_CONCURRENCY = 5;

function queryKey({ kind, title, year }: MatchQuery): string {
  return [kind, normalizeTitle(title), year ?? ''].join('\u0000');
}

/**
 * Scored TMDB candidates for each query (FC-23), in query order. Equal queries (episodes of one
 * show) are searched once. A query whose search fails comes back `failed` instead of failing the
 * whole batch; when every search fails, the provider error is thrown.
 */
export async function matchTitles(
  matcher: TmdbMatcher | undefined,
  queries: readonly MatchQuery[],
): Promise<MatchResponse> {
  if (!matcher) {
    throw new GatewayError('provider_not_configured', 'TMDB is not configured.', {
      provider: 'tmdb',
    });
  }

  const unique = new Map<string, MatchQuery>();
  for (const query of queries) {
    const key = queryKey(query);
    if (!unique.has(key)) unique.set(key, query);
  }

  const entries = [...unique];
  const answers = new Map<string, MatchResponse['results'][number]>();
  let lastError: unknown;
  for (let start = 0; start < entries.length; start += MATCH_CONCURRENCY) {
    await Promise.all(
      entries.slice(start, start + MATCH_CONCURRENCY).map(async ([key, query]) => {
        try {
          const candidates = await matcher.matchCandidates(query);
          answers.set(key, { candidates: scoreCandidates(query, candidates) });
        } catch (error) {
          lastError = error;
          answers.set(key, { candidates: [], failed: true });
        }
      }),
    );
  }

  if (entries.length > 0 && [...answers.values()].every((answer) => answer.failed)) {
    throw lastError;
  }
  if (lastError !== undefined) {
    const failed = [...answers.values()].filter((answer) => answer.failed).length;
    gatewayLog.warn('match.partial_failure', { failed, total: entries.length });
  }
  return { results: queries.map((query) => answers.get(queryKey(query))!) };
}
