import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SEARCH_STATE,
  flattenResults,
  isSearchable,
  parseSearchState,
  parseYearInput,
  resultCardData,
  searchDescription,
  searchPlatformLabel,
  searchRequestOf,
  searchStateUrl,
} from './search-state';

import type { SearchResult } from '@fanste/core';

const matrix: SearchResult = {
  provider: 'tmdb',
  externalId: 'movie:603',
  category: 'movie',
  title: 'The Matrix',
};

const abbeyRoad: SearchResult = {
  provider: 'discogs',
  externalId: 'release:2607424',
  category: 'music',
  title: 'Abbey Road',
  subtitle: 'The Beatles',
  releaseYear: 1969,
  detail: 'Vinyl, LP, Album · UK · PCS 7088',
};

const eldenRing: SearchResult = {
  provider: 'igdb',
  externalId: '119133',
  category: 'video_game',
  title: 'Elden Ring',
  subtitle: 'FromSoftware',
  releaseYear: 2022,
  detail: 'Series X|S · PS4 · Switch 2 · PC · PS5 · +1',
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
    expect(isSearchable('music')).toBe(true);
    expect(isSearchable('video_game')).toBe(true);
    expect(isSearchable('custom')).toBe(false);
  });
});

describe('parseSearchState', () => {
  it('keeps the rest of the search when the medium is unknown', () => {
    expect(parseSearchState({ category: 'music', q: 'Abbey Road', format: 'vinyl' })).toEqual({
      category: 'music',
      q: 'Abbey Road',
    });
  });

  it('reads the category, query and year', () => {
    expect(parseSearchState({ category: 'tv', q: ' Lost ', year: '2004' })).toEqual({
      category: 'tv',
      q: 'Lost',
      year: 2004,
    });
  });

  it('keeps the medium only for music', () => {
    expect(parseSearchState({ category: 'music', q: 'Abbey Road', format: 'Vinyl' })).toEqual({
      category: 'music',
      q: 'Abbey Road',
      format: 'Vinyl',
    });
    expect(parseSearchState({ category: 'movie', q: 'Inception', format: 'Vinyl' })).toEqual({
      category: 'movie',
      q: 'Inception',
    });
  });

  it('keeps the country and code only for music', () => {
    expect(
      parseSearchState({ category: 'music', q: '', country: 'UK', code: 'EPC 450290 1' }),
    ).toEqual({ category: 'music', q: '', country: 'UK', code: 'EPC 450290 1' });
    expect(parseSearchState({ category: 'movie', q: 'Inception', country: 'UK' })).toEqual({
      category: 'movie',
      q: 'Inception',
    });
  });

  it('keeps the game platform only for video games', () => {
    expect(parseSearchState({ category: 'video_game', q: 'Elden Ring', platform: '167' })).toEqual({
      category: 'video_game',
      q: 'Elden Ring',
      platform: 167,
    });
    expect(parseSearchState({ category: 'movie', q: 'Inception', platform: '167' })).toEqual({
      category: 'movie',
      q: 'Inception',
    });
  });

  it('falls back to the default of each invalid or unsearchable value', () => {
    expect(parseSearchState({ category: 'vhs', q: 'Alien' })).toEqual({
      category: 'movie',
      q: 'Alien',
    });
    expect(parseSearchState({})).toEqual(DEFAULT_SEARCH_STATE);
    expect(parseSearchState({ category: 'custom', q: 'Batman' })).toEqual({
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

  it('writes the medium only for music', () => {
    expect(searchStateUrl({ category: 'music', q: 'Abbey Road', format: 'Vinyl' })).toBe(
      '/search?category=music&q=Abbey+Road&format=Vinyl',
    );
    expect(searchStateUrl({ category: 'music', q: '', country: 'UK', code: 'EPC 450290 1' })).toBe(
      '/search?category=music&country=UK&code=EPC+450290+1',
    );
    expect(searchStateUrl({ category: 'movie', q: 'Inception', format: 'Vinyl' })).toBe(
      '/search?category=movie&q=Inception',
    );
  });

  it('writes the game platform only for video games', () => {
    expect(searchStateUrl({ category: 'video_game', q: 'Elden Ring', platform: 167 })).toBe(
      '/search?category=video_game&q=Elden+Ring&platform=167',
    );
    expect(searchStateUrl({ category: 'movie', q: 'Inception', platform: 167 })).toBe(
      '/search?category=movie&q=Inception',
    );
  });
});

describe('searchRequestOf', () => {
  it('returns null while there is nothing to search for', () => {
    expect(searchRequestOf({ category: 'movie' }, { q: '  ' })).toBeNull();
  });

  it('runs a music lookup by code alone', () => {
    expect(
      searchRequestOf(
        { category: 'music', format: 'Vinyl' },
        { q: '', country: ' UK ', code: 'EPC 450290 1' },
      ),
    ).toEqual({ category: 'music', q: '', format: 'Vinyl', country: 'UK', code: 'EPC 450290 1' });
  });

  it('includes the platform only for video games', () => {
    expect(searchRequestOf({ category: 'video_game', platform: 130 }, { q: 'Zelda' })).toEqual({
      category: 'video_game',
      q: 'Zelda',
      platform: 130,
    });
    expect(searchRequestOf({ category: 'movie', platform: 130 }, { q: 'Inception' })).toEqual({
      category: 'movie',
      q: 'Inception',
    });
  });

  it('drops the music filters for other categories', () => {
    expect(
      searchRequestOf(
        { category: 'movie', year: 2010, format: 'Vinyl' },
        { q: 'Inception', country: 'UK', code: 'PCS 7088' },
      ),
    ).toEqual({ category: 'movie', q: 'Inception', year: 2010 });
  });
});

describe('searchDescription', () => {
  it('describes the query and the filters', () => {
    expect(searchDescription({ category: 'music', q: 'Bad', format: 'Vinyl', country: 'UK' })).toBe(
      'matching “Bad” on Vinyl from UK',
    );
    expect(searchDescription({ category: 'music', q: '', code: 'EPC 450290 1' })).toBe(
      'with barcode or catalog number “EPC 450290 1”',
    );
    expect(searchDescription({ category: 'video_game', q: 'Elden Ring', platform: 167 })).toBe(
      'matching “Elden Ring” on PS5',
    );
  });
});

describe('searchPlatformLabel', () => {
  it('shows a popular platform by its label and others by their IGDB name', () => {
    expect(searchPlatformLabel(167)).toBe('PS5');
    expect(searchPlatformLabel(41, [{ id: 41, name: 'Wii U', abbreviation: 'WiiU' }])).toBe(
      'Wii U',
    );
    expect(searchPlatformLabel(41)).toBe('the chosen platform');
  });
});

describe('resultCardData', () => {
  it('shows the artist and the pressing of a record', () => {
    expect(resultCardData(abbeyRoad)).toEqual({
      provider: 'discogs',
      externalId: 'release:2607424',
      category: 'music',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
      releaseYear: 1969,
      badges: ['Vinyl, LP, Album', 'UK', 'PCS 7088'],
    });
  });

  it('shows the developer and the platforms of a game', () => {
    expect(resultCardData(eldenRing)).toEqual({
      provider: 'igdb',
      externalId: '119133',
      category: 'video_game',
      title: 'Elden Ring',
      subtitle: 'FromSoftware',
      releaseYear: 2022,
      badges: ['Series X|S', 'PS4', 'Switch 2', 'PC', 'PS5', '+1'],
    });
  });

  it('leaves the subtitle and badges off other cards', () => {
    expect(resultCardData({ ...matrix, subtitle: 'Warner Bros.' })).toEqual(matrix);
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
