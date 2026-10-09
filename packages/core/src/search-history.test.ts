import { describe, expect, it } from 'vitest';

import {
  addRecentSearch,
  MAX_RECENT_SEARCHES,
  parseRecentSearches,
  removeRecentSearch,
} from './search-history';

import type { RecentSearch } from './search-history';

const matrix: RecentSearch = { category: 'movie', q: 'The Matrix', year: 1999 };
const lost: RecentSearch = { category: 'tv', q: 'Lost' };

describe('addRecentSearch', () => {
  it('puts the search first and removes its earlier copy', () => {
    expect(
      addRecentSearch([lost, matrix], { category: 'movie', q: 'the matrix', year: 1999 }),
    ).toEqual([{ category: 'movie', q: 'the matrix', year: 1999 }, lost]);
  });

  it('keeps at most the maximum number of searches', () => {
    const list = Array.from({ length: MAX_RECENT_SEARCHES }, (_, index) => ({
      category: 'movie' as const,
      q: `Star Wars ${index + 1}`,
    }));
    const next = addRecentSearch(list, lost);
    expect(next.length).toBe(MAX_RECENT_SEARCHES);
    expect(next[0]).toEqual(lost);
  });
});

describe('removeRecentSearch', () => {
  it('removes the matching search', () => {
    expect(removeRecentSearch([lost, matrix], { ...matrix, q: 'THE MATRIX' })).toEqual([lost]);
  });
});

describe('parseRecentSearches', () => {
  it('keeps valid entries and drops invalid ones', () => {
    expect(parseRecentSearches([matrix, { category: 'vhs', q: 'Alien' }, { q: '' }, lost])).toEqual(
      [matrix, lost],
    );
    expect(parseRecentSearches('not a list')).toEqual([]);
  });
});
