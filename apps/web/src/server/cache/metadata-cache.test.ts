import { describe, expect, it } from 'vitest';

import { isStale, refKey } from './metadata-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-09T12:00:00Z');

describe('isStale', () => {
  it('marks rows older than the provider TTL as stale', () => {
    expect(isStale(new Date(now.getTime() - 29 * DAY_MS), 'tmdb', now)).toBe(false);
    expect(isStale(new Date(now.getTime() - 31 * DAY_MS), 'tmdb', now)).toBe(true);
  });
});

describe('refKey', () => {
  it('joins the provider and external ID', () => {
    expect(refKey({ provider: 'tmdb', externalId: 'movie:603' })).toBe('tmdb/movie:603');
  });
});
