import { describe, expect, it } from 'vitest';

import { createLruCache } from './lru';

describe('createLruCache', () => {
  it('returns values until their TTL runs out', () => {
    const cache = createLruCache<string>({ maxEntries: 10, ttlMs: 1000 });
    cache.set('movie\u0000the matrix\u00001', 'The Matrix', 0);
    expect(cache.get('movie\u0000the matrix\u00001', 999)).toBe('The Matrix');
    expect(cache.get('movie\u0000the matrix\u00001', 1000)).toBeUndefined();
  });

  it('evicts the least recently used entry', () => {
    const cache = createLruCache<string>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('tmdb/movie:603', 'The Matrix', 0);
    cache.set('tmdb/movie:604', 'The Matrix Reloaded', 0);
    cache.get('tmdb/movie:603', 1);
    cache.set('tmdb/movie:605', 'The Matrix Revolutions', 2);
    expect(cache.get('tmdb/movie:603', 3)).toBe('The Matrix');
    expect(cache.get('tmdb/movie:604', 3)).toBeUndefined();
    expect(cache.get('tmdb/movie:605', 3)).toBe('The Matrix Revolutions');
  });
});
