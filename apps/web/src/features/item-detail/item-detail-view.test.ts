import { describe, expect, it } from 'vitest';

import {
  copyFieldValues,
  creatorsLabel,
  formatRuntime,
  LOADING_TITLE,
  mediaFacts,
  originalValueText,
  overrideFieldValues,
  parseNameList,
  toCopyPatch,
  toDetailsPatch,
  toItemDetailView,
  toOverridesPatch,
} from './item-detail-view';

import type { CollectionItem, NormalizedItem } from '@fanste/core';

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

const copy: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
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

describe('parseNameList', () => {
  it('splits a typed list into trimmed names', () => {
    expect(parseNameList(' Christopher Nolan, , Emma Thomas ')).toEqual([
      'Christopher Nolan',
      'Emma Thomas',
    ]);
  });
});
