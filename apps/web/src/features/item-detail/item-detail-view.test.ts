import { describe, expect, it } from 'vitest';

import {
  copyFieldValues,
  creatorsLabel,
  detailsCategory,
  fileMarkerOf,
  formatRuntime,
  formatSummary,
  LOADING_TITLE,
  matrixCodesOf,
  mediaFacts,
  originalValueText,
  overrideFieldValues,
  parseNameList,
  showsCreators,
  toCopyPatch,
  toDetailsPatch,
  toItemDetailView,
  toOverridesPatch,
  tracklistOf,
} from './item-detail-view';

import type { CollectionItem, FileDetails, NormalizedItem } from '@fanste/core';

const posterUrl = 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg';
const customCover = 'https://images.example.com/inception-steelbook.jpg';

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
  imageUrl: posterUrl,
  genres: ['Action', 'Science Fiction'],
  creators: ['Christopher Nolan'],
  extra: { runtimeMinutes: 148, originalLanguage: 'en' },
};

const breakingBad: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'tv:1396',
  category: 'tv',
  title: 'Breaking Bad',
  extra: { seasonCount: 5, episodeCount: 62, status: 'Ended', networks: ['AMC'] },
};

const abbeyRoad: NormalizedItem = {
  provider: 'discogs',
  externalId: 'release:2607424',
  category: 'music',
  title: 'Abbey Road',
  subtitle: 'The Beatles',
  creators: ['The Beatles'],
  extra: {
    discogsType: 'release',
    country: 'UK',
    labels: [{ name: 'Apple Records', catalogNumber: 'PCS 7088' }],
    catalogNumber: 'PCS 7088',
    formats: [{ name: 'Vinyl', quantity: 1, descriptions: ['LP', 'Album'], text: 'Stereo' }],
    matrix: [{ value: 'YEX.749', description: 'Side A label' }],
    tracklist: [
      { position: 'A1', title: 'Come Together', duration: '4:19' },
      { position: 'A2', title: 'Something', duration: '3:02' },
    ],
  },
};

const eldenRing: NormalizedItem = {
  provider: 'igdb',
  externalId: '119133',
  category: 'video_game',
  title: 'Elden Ring',
  subtitle: 'FromSoftware',
  creators: ['FromSoftware'],
  extra: {
    platforms: [
      { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
      { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
    ],
    publishers: ['Bandai Namco Entertainment', 'FromSoftware'],
    gameType: 'Main Game',
  },
};

const copy: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  customCollectionId: null,
  customData: null,
  format: '4K UHD Blu-ray',
  details: {},
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: '2026-01-31',
  purchasePrice: 24.99,
  estimatedValue: null,
  currency: null,
  notes: null,
  source: 'search',
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
  tagIds: [],
  metadata: inception,
};

const fileDetails: FileDetails = {
  hdr: 'Dolby Vision',
  subtitleLanguages: ['en', 'sr'],
};

describe('toItemDetailView', () => {
  it('shows the metadata with the overrides applied', () => {
    const view = toItemDetailView({
      ...copy,
      metadataOverrides: { title: 'Inception (Steelbook)', imageUrl: customCover },
    });
    expect(view.title).toBe('Inception (Steelbook)');
    expect(view.display?.imageUrl).toBe(customCover);
    expect(view.original).toEqual(inception);
    expect([...view.overridden]).toEqual(['title', 'imageUrl']);
    expect(view.coverUnoptimized).toBe(true);
  });

  it('uses the provider item until the metadata is cached', () => {
    expect(toItemDetailView({ ...copy, metadata: null }, inception).title).toBe('Inception');
    expect(toItemDetailView({ ...copy, metadata: null }).title).toBe(LOADING_TITLE);
  });
});

describe('formatRuntime', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatRuntime(148)).toBe('2 h 28 min');
    expect(formatRuntime(45)).toBe('45 min');
    expect(formatRuntime(120)).toBe('2 h');
  });
});

describe('creatorsLabel', () => {
  it('names the creators for the category', () => {
    expect(creatorsLabel('movie')).toBe('Directed by');
    expect(creatorsLabel('tv')).toBe('Created by');
    expect(creatorsLabel('music')).toBe('Artists');
    expect(creatorsLabel('video_game')).toBe('Developed by');
  });
});

describe('showsCreators', () => {
  it('hides the artists of a record when they are its subtitle', () => {
    expect(showsCreators(inception)).toBe(true);
    expect(showsCreators(abbeyRoad)).toBe(false);
    expect(showsCreators({ ...abbeyRoad, subtitle: 'Various' })).toBe(true);
  });

  it('hides the developers of a game when they are its subtitle', () => {
    expect(showsCreators(eldenRing)).toBe(false);
  });
});

describe('formatSummary', () => {
  it('describes each format and joins box set parts', () => {
    expect(
      formatSummary([
        { name: 'Vinyl', quantity: 2, descriptions: ['LP', 'Album'], text: 'Red' },
        { name: 'Box Set', descriptions: ['Limited Edition'] },
      ]),
    ).toBe('2×Vinyl, LP, Album, Red + Box Set, Limited Edition');
  });
});

describe('tracklistOf', () => {
  it('returns the tracks of a record and nothing for other categories', () => {
    expect(tracklistOf(abbeyRoad)).toEqual([
      { position: 'A1', title: 'Come Together', duration: '4:19' },
      { position: 'A2', title: 'Something', duration: '3:02' },
    ]);
    expect(tracklistOf(inception)).toEqual([]);
  });
});

describe('matrixCodesOf', () => {
  it('returns the matrix codes of a record and nothing for other categories', () => {
    expect(matrixCodesOf(abbeyRoad)).toEqual([{ value: 'YEX.749', description: 'Side A label' }]);
    expect(matrixCodesOf(inception)).toEqual([]);
  });
});

describe('mediaFacts', () => {
  it('lists the facts of a movie', () => {
    expect(mediaFacts(inception)).toEqual([
      { label: 'Runtime', value: '2 h 28 min' },
      { label: 'Original language', value: 'English' },
    ]);
  });

  it('lists the facts of a TV show', () => {
    expect(mediaFacts(breakingBad)).toEqual([
      { label: 'Seasons', value: '5' },
      { label: 'Episodes', value: '62' },
      { label: 'Status', value: 'Ended' },
      { label: 'Network', value: 'AMC' },
    ]);
  });

  it('lists the facts of a music release', () => {
    expect(mediaFacts(abbeyRoad)).toEqual([
      { label: 'Label', value: 'Apple Records' },
      { label: 'Catalog number', value: 'PCS 7088' },
      { label: 'Country', value: 'UK' },
      { label: 'Format', value: 'Vinyl, LP, Album, Stereo' },
    ]);
  });

  it('lists the platforms, developer and publishers of a game', () => {
    expect(mediaFacts(eldenRing)).toEqual([
      { label: 'Platforms', value: 'PC (Microsoft Windows), PlayStation 5' },
      { label: 'Developer', value: 'FromSoftware' },
      { label: 'Publishers', value: 'Bandai Namco Entertainment, FromSoftware' },
    ]);
    expect(
      mediaFacts({ ...eldenRing, extra: { ...eldenRing.extra, gameType: 'Remaster' } }),
    ).toContainEqual({ label: 'Type', value: 'Remaster' });
  });

  it('lists the barcodes of a release', () => {
    const withBarcodes = (barcodes: string[]) =>
      mediaFacts({ ...abbeyRoad, extra: { ...abbeyRoad.extra, barcodes } });
    expect(withBarcodes(['5 099745 042210'])).toContainEqual({
      label: 'Barcode',
      value: '5 099745 042210',
    });
    expect(withBarcodes(['5 099745 042210', '5099745042227'])).toContainEqual({
      label: 'Barcodes',
      value: '5 099745 042210, 5099745042227',
    });
  });
});

describe('originalValueText', () => {
  it('describes the provider value of an overridden field', () => {
    expect(originalValueText('genres', inception, 'tmdb')).toBe(
      'Original: Action, Science Fiction',
    );
    expect(originalValueText('imageUrl', inception, 'tmdb')).toBe('Original: the TMDB cover');
    expect(originalValueText('subtitle', inception, 'tmdb')).toBe('No value from TMDB');
  });
});

describe('copyFieldValues', () => {
  it('turns the copy fields into form text', () => {
    expect(copyFieldValues(copy)).toEqual({
      ownership: 'owned',
      quantity: '1',
      acquiredAt: '2026-01-31',
      purchasePrice: '24.99',
      estimatedValue: '',
      currency: '',
      notes: '',
      format: '4K UHD Blu-ray',
    });
  });
});

describe('toCopyPatch', () => {
  it('converts valid fields and adds the default currency to a new price', () => {
    expect(
      toCopyPatch({ quantity: '2', purchasePrice: '12,50' }, { currency: null }, 'EUR'),
    ).toEqual({ patch: { quantity: 2, purchasePrice: 12.5, currency: 'EUR' }, errors: {} });
    expect(toCopyPatch({ estimatedValue: '30' }, { currency: 'USD' }, 'EUR')).toEqual({
      patch: { estimatedValue: 30 },
      errors: {},
    });
  });

  it('reports invalid fields instead of patching them', () => {
    expect(
      toCopyPatch({ quantity: '0', estimatedValue: 'abc', notes: 'Signed' }, copy, 'EUR'),
    ).toEqual({
      patch: { notes: 'Signed' },
      errors: {
        quantity: 'Enter a whole number from 1 to 9999.',
        estimatedValue: 'Enter an amount of 0 or more, with at most two decimals.',
      },
    });
  });
});

describe('detailsCategory', () => {
  it('picks the copy-details form of the category', () => {
    expect(detailsCategory('music')).toBe('music');
    expect(detailsCategory('tv')).toBe('tv');
    expect(detailsCategory('video_game')).toBe('video_game');
    expect(detailsCategory('board_game')).toBe('movie');
  });
});

describe('toDetailsPatch', () => {
  it('sets filled fields and removes empty ones', () => {
    expect(
      toDetailsPatch('tv', { edition: 'Steelbook', region: ' ', subtitleLanguages: [] }),
    ).toEqual({
      patch: { edition: 'Steelbook', region: null, subtitleLanguages: null },
      errors: {},
    });
  });

  it('reports an invalid disc count and ignores seasons of a movie', () => {
    expect(
      toDetailsPatch('movie', {
        discCount: 0,
        seasons: [{ seasonNumber: 1, episodesOwned: 'all' }],
      }),
    ).toEqual({
      patch: {},
      errors: { 'details.discCount': 'Enter a number of discs from 1 to 99.' },
    });
  });

  it('patches the fields of a music copy', () => {
    expect(toDetailsPatch('music', { mediaCondition: 'VG+', variant: ' ' })).toEqual({
      patch: { mediaCondition: 'VG+', variant: null },
      errors: {},
    });
  });

  it('patches the fields of a video game copy', () => {
    expect(
      toDetailsPatch('video_game', { platform: 'PlayStation 5', completeness: 'CIB', region: '' }),
    ).toEqual({
      patch: { platform: 'PlayStation 5', completeness: 'CIB', region: null },
      errors: {},
    });
  });
});

describe('overrideFieldValues', () => {
  it('turns the displayed metadata into form text', () => {
    expect(overrideFieldValues(inception)).toEqual({
      title: 'Inception',
      subtitle: '',
      releaseYear: '2010',
      imageUrl: posterUrl,
      description: '',
      genres: 'Action, Science Fiction',
      creators: 'Christopher Nolan',
    });
    expect(overrideFieldValues(undefined).title).toBe('');
  });
});

describe('toOverridesPatch', () => {
  it('sets changed fields and resets empty ones and provider values', () => {
    expect(
      toOverridesPatch(
        {
          title: 'Inception (Extended)',
          genres: 'Drama, Crime',
          subtitle: '',
          releaseYear: '2010',
          creators: 'Christopher Nolan',
        },
        inception,
      ),
    ).toEqual({
      patch: {
        title: 'Inception (Extended)',
        genres: ['Drama', 'Crime'],
        subtitle: null,
        releaseYear: null,
        creators: null,
      },
      errors: {},
    });
  });

  it('reports an empty title and invalid values', () => {
    const { patch, errors } = toOverridesPatch(
      { title: '  ', releaseYear: '20x0', imageUrl: 'http://images.example.com/cover.jpg' },
      inception,
    );
    expect(patch).toEqual({});
    expect(errors).toEqual({
      title: 'The title can’t be empty.',
      releaseYear: 'Enter a year from 1 to 9999.',
      imageUrl: 'Enter an https:// image address.',
    });
  });
});

describe('fileMarkerOf', () => {
  it('marks values that are still what the file headers said', () => {
    expect(fileMarkerOf('hdr', 'Dolby Vision', fileDetails)).toEqual({ kind: 'file' });
    expect(fileMarkerOf('subtitleLanguages', ['en', 'sr'], fileDetails)).toEqual({ kind: 'file' });
    expect(fileMarkerOf('resolution', '2160p', fileDetails)).toBeUndefined();
    expect(fileMarkerOf('edition', 'Steelbook', fileDetails)).toBeUndefined();
  });

  it('marks changed or cleared values as edited with the file value', () => {
    expect(fileMarkerOf('hdr', 'HDR10', fileDetails)).toEqual({
      kind: 'edited',
      fileValue: 'Dolby Vision',
      hint: 'File: Dolby Vision',
    });
    expect(fileMarkerOf('subtitleLanguages', undefined, fileDetails)).toEqual({
      kind: 'edited',
      fileValue: ['en', 'sr'],
      hint: 'File: English, Serbian',
    });
  });
});

describe('parseNameList', () => {
  it('splits a typed list into trimmed names', () => {
    expect(parseNameList(' Christopher Nolan, , Emma Thomas ')).toEqual([
      'Christopher Nolan',
      'Emma Thomas',
    ]);
  });
});
