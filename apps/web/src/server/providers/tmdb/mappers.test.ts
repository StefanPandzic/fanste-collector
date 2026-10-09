import { describe, expect, it } from 'vitest';

import configuration from './__fixtures__/configuration.json';
import movieFixture from './__fixtures__/movie-27205.json';
import tvFixture from './__fixtures__/tv-1396.json';
import { DEFAULT_IMAGE_CONFIG } from './configuration';
import { mapMovie, mapMovieSearchResult, mapTv, mapTvSearchResult, yearOf } from './mappers';
import { tmdbMovieSchema, tmdbTvSchema } from './schemas';

import type { TmdbImageConfig } from './configuration';

const images: TmdbImageConfig = {
  baseUrl: configuration.images.secure_base_url,
  posterSizes: configuration.images.poster_sizes,
};
const inception = tmdbMovieSchema.parse(movieFixture);
const breakingBad = tmdbTvSchema.parse(tvFixture);

describe('yearOf', () => {
  it('reads the year of a TMDB date', () => {
    expect(yearOf('2010-07-15')).toBe(2010);
  });

  it('returns undefined for an unknown date', () => {
    expect(yearOf('')).toBeUndefined();
    expect(yearOf(null)).toBeUndefined();
  });
});

describe('mapMovieSearchResult', () => {
  it('maps a search result with a thumbnail', () => {
    expect(
      mapMovieSearchResult(
        {
          id: 27205,
          title: 'Inception',
          release_date: '2010-07-15',
          poster_path: '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
        },
        images,
      ),
    ).toEqual({
      provider: 'tmdb',
      externalId: 'movie:27205',
      category: 'movie',
      title: 'Inception',
      releaseYear: 2010,
      thumbnailUrl: 'https://image.tmdb.org/t/p/w185/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
    });
  });

  it('skips results without a title', () => {
    expect(
      mapMovieSearchResult({ id: 27205, title: '', original_title: null }, images),
    ).toBeUndefined();
  });
});

describe('mapTvSearchResult', () => {
  it('maps a search result with its first air year', () => {
    expect(
      mapTvSearchResult(
        { id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20', poster_path: null },
        DEFAULT_IMAGE_CONFIG,
      ),
    ).toEqual({
      provider: 'tmdb',
      externalId: 'tv:1396',
      category: 'tv',
      title: 'Breaking Bad',
      releaseYear: 2008,
    });
  });
});

describe('mapMovie', () => {
  it('maps a movie with directors as creators and the movie extras', () => {
    const item = mapMovie(inception, images);
    expect(item).toMatchObject({
      externalId: 'movie:27205',
      category: 'movie',
      title: 'Inception',
      releaseYear: 2010,
      imageUrl: 'https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg',
      creators: ['Christopher Nolan'],
      sourceUrl: 'https://www.themoviedb.org/movie/27205',
    });
    expect(item?.extra).toMatchObject({
      runtimeMinutes: 148,
      imdbId: 'tt1375666',
      originalLanguage: 'en',
    });
    expect(item?.extra).not.toHaveProperty('originalTitle');
  });

  it('drops the TMDB "xx" no-language code', () => {
    const item = mapMovie({ ...inception, original_language: 'xx' }, images);
    expect(item?.extra).not.toHaveProperty('originalLanguage');
  });
});

describe('mapTv', () => {
  it('maps a show with its creators, first network and seasons', () => {
    const item = mapTv(breakingBad, images);
    expect(item).toMatchObject({
      externalId: 'tv:1396',
      category: 'tv',
      title: 'Breaking Bad',
      subtitle: 'AMC',
      releaseYear: 2008,
      creators: ['Vince Gilligan'],
    });
    expect(item?.extra).toMatchObject({
      imdbId: 'tt0903747',
      originalLanguage: 'en',
      seasonCount: 5,
      networks: ['AMC'],
    });
    expect(item?.extra).toHaveProperty('seasons');
  });
});
