import { describe, expect, it } from 'vitest';

import { fromMetadataCacheRow, toMetadataCacheRow } from './metadata-cache';

import type { MetadataCacheRow } from './metadata-cache';
import type { NormalizedItem } from './normalized-item';

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  subtitle: 'Christopher Nolan',
  releaseYear: 2010,
  imageUrl: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
  genres: ['Action', 'Science Fiction'],
  extra: { runtimeMinutes: 148, imdbId: 'tt1375666' },
  sourceUrl: 'https://www.themoviedb.org/movie/27205',
};

const breakingBadRow: MetadataCacheRow = {
  provider: 'tmdb',
  external_id: 'tv:1396',
  category: 'tv',
  title: 'Breaking Bad',
  subtitle: null,
  release_year: 2008,
  image_url: null,
  payload: null,
};

describe('toMetadataCacheRow', () => {
  it('maps the item to snake_case columns and puts the other fields in payload', () => {
    expect(toMetadataCacheRow(inception)).toEqual({
      provider: 'tmdb',
      external_id: 'movie:27205',
      category: 'movie',
      title: 'Inception',
      subtitle: 'Christopher Nolan',
      release_year: 2010,
      image_url: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      payload: {
        genres: ['Action', 'Science Fiction'],
        extra: { runtimeMinutes: 148, imdbId: 'tt1375666' },
        sourceUrl: 'https://www.themoviedb.org/movie/27205',
      },
    });
    expect(
      toMetadataCacheRow({
        provider: 'tmdb',
        externalId: 'tv:1396',
        category: 'tv',
        title: 'Breaking Bad',
      }).payload,
    ).toBe(null);
  });

  it('throws for custom items', () => {
    expect(() =>
      toMetadataCacheRow({
        provider: 'custom',
        externalId: '6f1c2a8e-3b4d-4e5f-9a7b-1c2d3e4f5a6b',
        category: 'funko',
        title: 'Funko Pop! Walter White',
      }),
    ).toThrow(/not stored in the metadata cache/);
  });

  it('throws for an invalid item instead of caching it', () => {
    expect(() => toMetadataCacheRow({ ...inception, releaseYear: 0 })).toThrow();
    expect(() => toMetadataCacheRow({ ...inception, externalId: 'tv:27205' })).toThrow();
  });
});

describe('fromMetadataCacheRow', () => {
  it('round-trips with toMetadataCacheRow', () => {
    expect(fromMetadataCacheRow(toMetadataCacheRow(inception))).toEqual(inception);
  });

  it('drops invalid payload fields instead of throwing', () => {
    expect(
      fromMetadataCacheRow({
        ...breakingBadRow,
        payload: {
          genres: 'Drama',
          sourceUrl: 'ftp://www.themoviedb.org/tv/1396',
          description: 'A chemistry teacher turns to cooking meth.',
        },
      }),
    ).toEqual({
      provider: 'tmdb',
      externalId: 'tv:1396',
      category: 'tv',
      title: 'Breaking Bad',
      releaseYear: 2008,
      description: 'A chemistry teacher turns to cooking meth.',
    });
  });

  it('drops invalid column values instead of throwing', () => {
    expect(
      fromMetadataCacheRow({
        ...breakingBadRow,
        subtitle: '',
        release_year: 0,
        image_url: 'not a url',
      }),
    ).toEqual({ provider: 'tmdb', externalId: 'tv:1396', category: 'tv', title: 'Breaking Bad' });
  });
});
