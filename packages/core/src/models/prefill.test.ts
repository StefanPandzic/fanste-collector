import { describe, expect, it } from 'vitest';

import { copyDefaultsFrom, parsePreferences, prefillDetails } from './prefill';

import type { NormalizedItem } from './normalized-item';

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  extra: { runtimeMinutes: 148, originalLanguage: 'en' },
};

const breakingBadSeasons = [
  { seasonNumber: 1, name: 'Season 1', episodeCount: 7, airYear: 2008 },
  { seasonNumber: 2, name: 'Season 2', episodeCount: 13, airYear: 2009 },
];

const breakingBad: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'tv:1396',
  category: 'tv',
  title: 'Breaking Bad',
  extra: { originalLanguage: 'en', seasons: breakingBadSeasons },
};

const defaults = { format: '4K UHD Blu-ray', details: { resolution: '2160p', hdr: 'HDR10' } };

describe('prefillDetails', () => {
  it('suggests the last-used values and the original language as audio', () => {
    expect(prefillDetails('movie', inception, { defaults })).toEqual({
      format: '4K UHD Blu-ray',
      details: { resolution: '2160p', hdr: 'HDR10', audioLanguages: ['en'] },
      choices: {},
    });
    expect(prefillDetails('tv', breakingBad).choices).toEqual({ seasons: breakingBadSeasons });
  });

  it('uses the scan instead of the last-used values', () => {
    expect(
      prefillDetails('movie', inception, {
        defaults,
        scan: {
          fileFormat: 'MKV',
          resolution: '1080p',
          audioChannels: '5.1',
          subtitleLanguages: ['en', 'sr'],
        },
      }),
    ).toEqual({
      format: 'Digital file',
      details: {
        fileFormat: 'MKV',
        resolution: '1080p',
        audioChannels: '5.1',
        audioLanguages: ['en'],
        subtitleLanguages: ['en', 'sr'],
      },
      choices: {},
    });
  });

  it('builds the owned seasons from scanned episodes', () => {
    const episodes = [
      ...[1, 2, 3, 4, 5, 6, 7].map((episodeNumber) => ({ seasonNumber: 1, episodeNumber })),
      { seasonNumber: 2, episodeNumber: 2 },
      { seasonNumber: 2, episodeNumber: 1 },
    ];
    expect(prefillDetails('tv', breakingBad, { scan: { episodes } }).details.seasons).toEqual([
      { seasonNumber: 1, episodesOwned: 'all' },
      { seasonNumber: 2, episodesOwned: [1, 2] },
    ]);
  });
});

describe('copyDefaultsFrom', () => {
  it('remembers the format and only the habit fields', () => {
    expect(
      copyDefaultsFrom('movie', '4K UHD Blu-ray', {
        resolution: '2160p',
        edition: 'Steelbook',
        discCount: 2,
        audioLanguages: ['en'],
      }),
    ).toEqual({ format: '4K UHD Blu-ray', details: { resolution: '2160p' } });
  });
});

describe('parsePreferences', () => {
  it('keeps valid copy defaults and drops invalid entries', () => {
    expect(
      parsePreferences({
        theme: 'dark',
        copyDefaults: {
          movie: { format: 'Blu-ray', details: { resolution: '1080p' } },
          tv: { format: 42 },
          vhs: { format: 'VHS' },
        },
      }),
    ).toEqual({
      copyDefaults: { movie: { format: 'Blu-ray', details: { resolution: '1080p' } } },
    });
  });
});
