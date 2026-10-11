import { describe, expect, it, vi } from 'vitest';

import { GatewayError } from './errors';
import { matchTitles } from './match';

import type { TmdbMatchCandidate, TmdbMatcher } from './providers/tmdb/adapter';
import type { MatchQuery } from '@fanste/core';

const inception: TmdbMatchCandidate = {
  item: {
    provider: 'tmdb',
    externalId: 'movie:27205',
    category: 'movie',
    title: 'Inception',
    releaseYear: 2010,
  },
  popularity: 85,
};

const severance: TmdbMatchCandidate = {
  item: {
    provider: 'tmdb',
    externalId: 'tv:95396',
    category: 'tv',
    title: 'Severance',
    releaseYear: 2022,
  },
  popularity: 60,
};

function fakeMatcher(answer: (query: MatchQuery) => Promise<TmdbMatchCandidate[]>) {
  const matchCandidates = vi.fn<TmdbMatcher['matchCandidates']>(answer);
  const matcher: TmdbMatcher = {
    matchCandidates,
    matchMovie: () => Promise.reject(new Error('not used')),
  };
  return { matcher, matchCandidates };
}

describe('matchTitles', () => {
  it('searches equal queries once and answers in request order', async () => {
    const { matcher, matchCandidates } = fakeMatcher((query) =>
      Promise.resolve(query.kind === 'tv' ? [severance] : [inception]),
    );
    const response = await matchTitles(matcher, [
      { title: 'Severance', kind: 'tv' },
      { title: 'Inception', year: 2010, kind: 'movie' },
      { title: 'severance', kind: 'tv' },
    ]);
    expect(matchCandidates).toHaveBeenCalledTimes(2);
    expect(response.results.map((result) => result.candidates[0]?.item.title)).toEqual([
      'Severance',
      'Inception',
      'Severance',
    ]);
    expect(response.results[1]?.candidates[0]?.confidence).toBe(1);
  });

  it('marks a failed search as failed and throws when every search fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const timeout = new GatewayError('provider_error', 'TMDB did not answer.', {
      provider: 'tmdb',
    });
    const { matcher } = fakeMatcher((query) =>
      query.title === 'Dune' ? Promise.reject(timeout) : Promise.resolve([inception]),
    );
    const response = await matchTitles(matcher, [
      { title: 'Dune', year: 2021, kind: 'movie' },
      { title: 'Inception', year: 2010, kind: 'movie' },
    ]);
    expect(response.results[0]).toEqual({ candidates: [], failed: true });
    expect(response.results[1]?.failed).toBeUndefined();

    await expect(matchTitles(matcher, [{ title: 'Dune', kind: 'movie' }])).rejects.toBe(timeout);
    vi.restoreAllMocks();
  });

  it('rejects with provider_not_configured without a TMDB matcher', async () => {
    const error: unknown = await matchTitles(undefined, [
      { title: 'Inception', kind: 'movie' },
    ]).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toHaveProperty('code', 'provider_not_configured');
  });
});
