import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@fanste/api-client';

import { isRetryableSearchError, retryingText, searchErrorText } from './search-errors';

const providerDown = new ApiClientError(502, 'provider_error', 'TMDB returned 503', 'tmdb');
const userLimited = new ApiClientError(429, 'rate_limited', 'Too many requests');
const offline = new TypeError('Failed to fetch');

describe('isRetryableSearchError', () => {
  it('retries provider failures, rate limits and dropped connections', () => {
    expect(isRetryableSearchError(providerDown)).toBe(true);
    expect(isRetryableSearchError(userLimited)).toBe(true);
    expect(isRetryableSearchError(offline)).toBe(true);
  });

  it('does not retry other errors', () => {
    expect(isRetryableSearchError(new ApiClientError(401, 'unauthorized', 'No session'))).toBe(
      false,
    );
    expect(isRetryableSearchError(new Error('boom'))).toBe(false);
  });
});

describe('searchErrorText', () => {
  it('describes the failure without the gateway message', () => {
    expect(searchErrorText(providerDown, 'TMDB')).toEqual({
      title: 'TMDB is not responding',
      description: 'TMDB is busy or down. Try again in a moment.',
    });
    expect(searchErrorText(userLimited, 'TMDB').title).toBe('Too many searches');
    expect(searchErrorText(offline, 'TMDB').title).toBe('You seem to be offline');
  });

  it('uses a generic text for unknown errors', () => {
    expect(searchErrorText(new Error('boom'), 'TMDB')).toEqual({
      title: 'Search failed',
      description: 'Something went wrong. Try again.',
    });
  });
});

describe('retryingText', () => {
  it('names what is being retried', () => {
    expect(retryingText(providerDown, 'TMDB')).toBe('TMDB is busy, retrying…');
    expect(retryingText(userLimited, 'TMDB')).toBe('Too many searches, retrying…');
    expect(retryingText(offline, 'TMDB')).toBe('Connection lost, retrying…');
  });
});
