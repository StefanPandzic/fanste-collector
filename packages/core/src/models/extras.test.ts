import { describe, expect, it } from 'vitest';

import { parseMovieExtra, parseMusicExtra, parseTvExtra, parseVideoGameExtra } from './extras';

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

describe('parseMusicExtra', () => {
  it('returns the release fields for valid input', () => {
    const extra = {
      discogsType: 'release',
      country: 'UK',
      labels: [{ name: 'Apple Records', catalogNumber: 'PCS 7088' }],
      catalogNumber: 'PCS 7088',
      formats: [{ name: 'Vinyl', quantity: 1, descriptions: ['LP', 'Album'] }],
      tracklist: [{ position: 'A1', title: 'Come Together', duration: '4:19' }],
      masterId: 24047,
    };
    expect(parseMusicExtra(extra)).toEqual(extra);
  });

  it('returns undefined for invalid input', () => {
    expect(parseMusicExtra({ formats: [{ name: 'Vinyl', quantity: 0 }] })).toBeUndefined();
  });
});

describe('parseVideoGameExtra', () => {
  it('returns the game fields for valid input', () => {
    const extra = {
      platforms: [
        { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
        { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
      ],
      publishers: ['Bandai Namco Entertainment'],
      gameType: 'Main Game',
    };
    expect(parseVideoGameExtra(extra)).toEqual(extra);
  });

  it('returns undefined for invalid input', () => {
    expect(parseVideoGameExtra({ platforms: [{ id: 0, name: 'PlayStation 5' }] })).toBeUndefined();
  });
});
