import { describe, expect, it } from 'vitest';

import {
  copyDetailsSchema,
  detailsSchemaFor,
  formatOwnedEpisodes,
  movieDetailsSchema,
  ownedEpisodeCount,
  parseDetails,
  seasonDetails,
  tvDetailsSchema,
} from './copy-details';

import type { TvDetails } from './copy-details';
import type { TvExtra } from './extras';

const breakingBadExtra: TvExtra = {
  seasons: [
    { seasonNumber: 1, name: 'Season 1', episodeCount: 7, airYear: 2008 },
    { seasonNumber: 2, name: 'Season 2', episodeCount: 13, airYear: 2009 },
  ],
};

const breakingBadCopy: TvDetails = {
  resolution: '1080p',
  audioLanguages: ['en'],
  seasons: [
    { seasonNumber: 1, episodesOwned: 'all' },
    { seasonNumber: 2, episodesOwned: [1, 2, 3, 4], subtitleLanguages: ['sr'] },
  ],
};

describe('movieDetailsSchema', () => {
  it('accepts a digital file with audio and subtitle languages', () => {
    expect(
      movieDetailsSchema.parse({
        fileFormat: 'MKV',
        resolution: '1080p',
        audioChannels: '5.1',
        audioLanguages: ['EN'],
        subtitleLanguages: ['en', 'sr', 'en'],
      }),
    ).toEqual({
      fileFormat: 'MKV',
      resolution: '1080p',
      audioChannels: '5.1',
      audioLanguages: ['en'],
      subtitleLanguages: ['en', 'sr'],
    });
  });

  it('rejects invalid values', () => {
    expect(movieDetailsSchema.safeParse({ discCount: 0 }).success).toBe(false);
    expect(movieDetailsSchema.safeParse({ audioLanguages: ['English'] }).success).toBe(false);
  });
});

describe('tvDetailsSchema', () => {
  it('sorts the seasons and their owned episodes', () => {
    expect(
      tvDetailsSchema.parse({
        seasons: [
          { seasonNumber: 2, episodesOwned: [4, 1, 3, 2, 1] },
          { seasonNumber: 1, episodesOwned: 'all' },
        ],
      }),
    ).toEqual({
      seasons: [
        { seasonNumber: 1, episodesOwned: 'all' },
        { seasonNumber: 2, episodesOwned: [1, 2, 3, 4] },
      ],
    });
  });

  it('rejects a season listed twice', () => {
    const result = tvDetailsSchema.safeParse({
      seasons: [
        { seasonNumber: 1, episodesOwned: 'all' },
        { seasonNumber: 1, episodesOwned: [1] },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('detailsSchemaFor', () => {
  it('returns the schema of the category', () => {
    expect(detailsSchemaFor('movie')).toBe(movieDetailsSchema);
    expect(detailsSchemaFor('tv')).toBe(tvDetailsSchema);
    expect(detailsSchemaFor('music').parse({ vinylColor: 'Red' })).toEqual({ vinylColor: 'Red' });
  });
});

describe('copyDetailsSchema', () => {
  it('accepts a 4K steelbook movie copy', () => {
    const copy = {
      category: 'movie',
      format: '4K UHD Blu-ray',
      details: { resolution: '2160p', hdr: 'Dolby Vision', edition: 'Steelbook', discCount: 2 },
    };
    expect(copyDetailsSchema.parse(copy)).toEqual(copy);
  });

  it('accepts a movie file with English audio and English + Serbian subtitles', () => {
    expect(
      copyDetailsSchema.parse({
        category: 'movie',
        format: 'Digital file',
        details: {
          fileFormat: 'MKV',
          resolution: '1080p',
          audioChannels: '5.1',
          audioLanguages: ['en'],
          subtitleLanguages: ['en', 'sr'],
        },
      }).details,
    ).toEqual({
      fileFormat: 'MKV',
      resolution: '1080p',
      audioChannels: '5.1',
      audioLanguages: ['en'],
      subtitleLanguages: ['en', 'sr'],
    });
  });

  it('checks details against the category and keeps a loose record for untyped ones', () => {
    expect(
      copyDetailsSchema.safeParse({ category: 'movie', details: { discCount: 0 } }).success,
    ).toBe(false);
    expect(
      copyDetailsSchema.parse({ category: 'music', format: 'Vinyl', details: { rpm: 33 } }),
    ).toEqual({ category: 'music', format: 'Vinyl', details: { rpm: 33 } });
  });
});

describe('parseDetails', () => {
  it('keeps the valid fields and drops the invalid ones', () => {
    expect(parseDetails('movie', { resolution: '2160p', discCount: 0, hdr: 42 })).toEqual({
      resolution: '2160p',
    });
  });

  it('drops invalid and duplicate seasons of a TV copy', () => {
    expect(
      parseDetails('tv', {
        seasons: [
          { seasonNumber: 2, episodesOwned: [1, 2] },
          { seasonNumber: 1, episodesOwned: 'some' },
          { seasonNumber: 2, episodesOwned: 'all' },
        ],
      }),
    ).toEqual({ seasons: [{ seasonNumber: 2, episodesOwned: [1, 2] }] });
  });
});

describe('seasonDetails', () => {
  it('fills the fields the season does not set from the show', () => {
    expect(seasonDetails(breakingBadCopy, 2, 'Digital file')).toEqual({
      seasonNumber: 2,
      episodesOwned: [1, 2, 3, 4],
      format: 'Digital file',
      resolution: '1080p',
      audioLanguages: ['en'],
      subtitleLanguages: ['sr'],
    });
  });

  it('returns undefined for a season that is not owned', () => {
    expect(seasonDetails(breakingBadCopy, 3)).toBeUndefined();
  });
});

describe('ownedEpisodeCount', () => {
  it('counts complete seasons and the episodes of the others', () => {
    expect(ownedEpisodeCount(breakingBadCopy, breakingBadExtra)).toEqual({
      fullSeasons: 1,
      extraEpisodes: 4,
      totalEpisodes: 11,
    });
  });

  it('treats a list with every episode of the season as complete', () => {
    const details: TvDetails = {
      seasons: [{ seasonNumber: 1, episodesOwned: [1, 2, 3, 4, 5, 6, 7] }],
    };
    expect(ownedEpisodeCount(details, breakingBadExtra)).toEqual({
      fullSeasons: 1,
      extraEpisodes: 0,
      totalEpisodes: 7,
    });
  });
});

describe('formatOwnedEpisodes', () => {
  it('describes full seasons and extra episodes', () => {
    expect(formatOwnedEpisodes(ownedEpisodeCount(breakingBadCopy, breakingBadExtra))).toBe(
      '1 full season + 4 episodes',
    );
    expect(formatOwnedEpisodes({ fullSeasons: 2, extraEpisodes: 0, totalEpisodes: 20 })).toBe(
      '2 full seasons',
    );
    expect(formatOwnedEpisodes({ fullSeasons: 0, extraEpisodes: 0, totalEpisodes: 0 })).toBe(
      'No episodes',
    );
  });
});
