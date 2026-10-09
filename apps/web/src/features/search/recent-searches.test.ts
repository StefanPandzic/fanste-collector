import { describe, expect, it } from 'vitest';

import { loadRecentSearches, recentSearchesKey, saveRecentSearches } from './recent-searches';

import type { RecentSearch } from '@fanste/core';

const key = recentSearchesKey('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d');
const matrix: RecentSearch = { category: 'movie', q: 'The Matrix', year: 1999 };

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (name) => values.get(name) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (name) => values.delete(name),
    setItem: (name, value) => values.set(name, value),
  };
}

const blockedStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
} as unknown as Storage;

describe('recentSearchesKey', () => {
  it('scopes the key to the user', () => {
    expect(key).toBe('fanste:recent-searches:9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d');
  });
});

describe('loadRecentSearches / saveRecentSearches', () => {
  it('stores the list and reads it back', () => {
    const storage = createStorage();
    saveRecentSearches(storage, key, [matrix]);
    expect(loadRecentSearches(storage, key)).toEqual([matrix]);
    saveRecentSearches(storage, key, []);
    expect(storage.getItem(key)).toBe(null);
  });

  it('returns an empty list and does not throw when storage fails', () => {
    expect(loadRecentSearches(blockedStorage, key)).toEqual([]);
    expect(() => saveRecentSearches(blockedStorage, key, [matrix])).not.toThrow();
  });
});
