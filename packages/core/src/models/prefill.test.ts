import { describe, expect, it } from 'vitest';

import {
  allSeasonsOwned,
  copyDefaultsFrom,
  ownAllSeasons,
  parsePreferences,
  prefillDetails,
  quickAddInput,
} from './prefill';

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
      sources: {
        format: 'defaults',
        resolution: 'defaults',
        hdr: 'defaults',
        audioLanguages: 'provider',
      },
    });
    expect(prefillDetails('tv', breakingBad).choices).toEqual({ seasons: breakingBadSeasons });
  });

  it('suggests the same values for a TV show and offers its seasons', () => {
    expect(prefillDetails('tv', breakingBad, { defaults })).toEqual({
      format: '4K UHD Blu-ray',
      details: { resolution: '2160p', hdr: 'HDR10', audioLanguages: ['en'] },
      choices: { seasons: breakingBadSeasons },
      sources: {
        format: 'defaults',
        resolution: 'defaults',
        hdr: 'defaults',
        audioLanguages: 'provider',
      },
    });
  });

  it('drops the source of an invalid last-used value', () => {
    const stale = { details: { resolution: 2160, hdr: 'HDR10' } };
    expect(prefillDetails('movie', null, { defaults: stale })).toEqual({
      details: { hdr: 'HDR10' },
      choices: {},
      sources: { hdr: 'defaults' },
    });
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
      sources: {
        format: 'scan',
        fileFormat: 'scan',
        resolution: 'scan',
        audioChannels: 'scan',
        audioLanguages: 'provider',
        subtitleLanguages: 'scan',
      },
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

describe('allSeasonsOwned', () => {
  it('owns every season but the Specials in full', () => {
    expect(
      allSeasonsOwned([
        { seasonNumber: 0, name: 'Specials', episodeCount: 2, airYear: 2009 },
        ...breakingBadSeasons,
      ]),
    ).toEqual([
      { seasonNumber: 1, episodesOwned: 'all' },
      { seasonNumber: 2, episodesOwned: 'all' },
    ]);
  });
});

describe('ownAllSeasons', () => {
  it('suggests every season of a TV show, marked as from the provider', () => {
    const prefill = ownAllSeasons('tv', prefillDetails('tv', breakingBad));
    expect(prefill.details.seasons).toEqual([
      { seasonNumber: 1, episodesOwned: 'all' },
      { seasonNumber: 2, episodesOwned: 'all' },
    ]);
    expect(prefill.sources.seasons).toBe('provider');
  });
});

describe('quickAddInput', () => {
  it('adds an owned copy with the suggested medium and details', () => {
    expect(
      quickAddInput({ category: 'movie', provider: 'tmdb', externalId: 'movie:27205' }, inception, {
        format: '4K UHD Blu-ray',
        details: { resolution: '2160p' },
      }),
    ).toEqual({
      category: 'movie',
      provider: 'tmdb',
      externalId: 'movie:27205',
      ownership: 'owned',
      format: '4K UHD Blu-ray',
      details: { resolution: '2160p', audioLanguages: ['en'] },
      source: 'search',
    });
  });

  it('owns every season of a TV show but the Specials', () => {
    const target = { category: 'tv', provider: 'tmdb', externalId: 'tv:1396' } as const;
    expect(quickAddInput(target, breakingBad, undefined).details).toEqual({
      audioLanguages: ['en'],
      seasons: [
        { seasonNumber: 1, episodesOwned: 'all' },
        { seasonNumber: 2, episodesOwned: 'all' },
      ],
    });
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
