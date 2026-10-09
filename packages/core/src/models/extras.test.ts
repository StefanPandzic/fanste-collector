import { describe, expect, it } from 'vitest';

import { parseMovieExtra, parseTvExtra } from './extras';

describe('parseMovieExtra', () => {
  it('returns the movie fields for valid input', () => {
    const extra = {
      runtimeMinutes: 148,
      imdbId: 'tt1375666',
      tagline: 'Your mind is the scene of the crime.',
      originalLanguage: 'en',
    };
    expect(parseMovieExtra(extra)).toEqual(extra);
  });

  it('returns undefined for invalid input', () => {
    expect(parseMovieExtra({ imdbId: '1375666' })).toBeUndefined();
  });
});

describe('parseTvExtra', () => {
  it('returns the TV fields for valid input', () => {
    const extra = {
      imdbId: 'tt0903747',
      originalLanguage: 'en',
      status: 'Ended',
      seasonCount: 5,
      networks: ['AMC'],
      seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 7, airYear: 2008 }],
    };
    expect(parseTvExtra(extra)).toEqual(extra);
  });

  it('returns undefined for invalid input', () => {
    expect(parseTvExtra({ seasons: [{ name: 'Season 1' }] })).toBeUndefined();
  });
});
