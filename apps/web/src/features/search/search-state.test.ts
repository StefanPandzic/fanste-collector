import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SEARCH_STATE,
  flattenResults,
  isSearchable,
  parseSearchState,
  parseYearInput,
  searchStateUrl,
} from './search-state';

import type { SearchResult } from '@fanste/core';

const matrix: SearchResult = {
  provider: 'tmdb',
  externalId: 'movie:603',
  category: 'movie',
  title: 'The Matrix',
};

const matrixReloaded: SearchResult = {
  provider: 'tmdb',
  externalId: 'movie:604',
  category: 'movie',
  title: 'The Matrix Reloaded',
};

describe('isSearchable', () => {
  it('allows categories whose provider is built', () => {
    expect(isSearchable('movie')).toBe(true);
    expect(isSearchable('tv')).toBe(true);
    expect(isSearchable('funko')).toBe(false);
  });
});

describe('parseSearchState', () => {
  it('reads the category, query and year', () => {
    expect(parseSearchState({ category: 'tv', q: ' Lost ', year: '2004' })).toEqual({
      category: 'tv',
      q: 'Lost',
      year: 2004,
    });
  });

  it('falls back to the defaults for invalid or unsearchable values', () => {
    expect(parseSearchState({ category: 'vhs', q: 'Alien' })).toEqual(DEFAULT_SEARCH_STATE);
    expect(parseSearchState({ category: 'funko', q: 'Batman' })).toEqual({
      category: 'movie',
      q: 'Batman',
    });
  });
});

describe('searchStateUrl', () => {
  it('builds the search page URL', () => {
    expect(searchStateUrl({ category: 'tv', q: ' lost ' })).toBe('/search?category=tv&q=lost');
    expect(searchStateUrl({ category: 'movie', q: 'The Matrix', year: 1999 })).toBe(
      '/search?category=movie&q=The+Matrix&year=1999',
    );
  });
});

describe('parseYearInput', () => {
  it('reads a four-digit year and ignores incomplete input', () => {
    expect(parseYearInput(' 1999 ')).toBe(1999);
    expect(parseYearInput('199')).toBeUndefined();
  });
});

describe('flattenResults', () => {
  it('joins the pages and keeps only the first appearance of an item', () => {
    expect(
      flattenResults([
        { results: [matrix], page: 1, totalPages: 2, totalResults: 2 },
        { results: [matrix, matrixReloaded], page: 2, totalPages: 2, totalResults: 2 },
      ]),
    ).toEqual([matrix, matrixReloaded]);
  });
});
