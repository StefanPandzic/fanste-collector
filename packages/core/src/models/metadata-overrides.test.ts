import { describe, expect, it } from 'vitest';

import { applyOverrides, metadataOverridesSchema, parseOverrides } from './metadata-overrides';

import type { NormalizedItem } from './normalized-item';

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
  imageUrl: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
  thumbnailUrl: 'https://image.tmdb.org/t/p/w185/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
};

const customCover = 'https://example.com/covers/inception-steelbook.jpg';

describe('metadataOverridesSchema', () => {
  it('accepts trimmed overrides', () => {
    expect(
      metadataOverridesSchema.parse({ title: ' Inception (Steelbook) ', genres: ['Sci-Fi'] }),
    ).toEqual({ title: 'Inception (Steelbook)', genres: ['Sci-Fi'] });
  });

  it('rejects invalid values', () => {
    expect(metadataOverridesSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(metadataOverridesSchema.safeParse({ imageUrl: 'file:///C:/cover.jpg' }).success).toBe(
      false,
    );
    // https only: an http cover would be mixed content on the https app.
    expect(
      metadataOverridesSchema.safeParse({ imageUrl: 'http://example.com/cover.jpg' }).success,
    ).toBe(false);
  });
});

describe('parseOverrides', () => {
  it('keeps the valid fields and drops the invalid ones', () => {
    expect(parseOverrides({ title: 'Inception', releaseYear: 'soon', imageUrl: 'cover' })).toEqual({
      title: 'Inception',
    });
  });
});

describe('applyOverrides', () => {
  it('puts the overrides on top and lists the overridden fields', () => {
    expect(
      applyOverrides(inception, { title: 'Inception (Steelbook)', releaseYear: 2011 }),
    ).toEqual({
      item: { ...inception, title: 'Inception (Steelbook)', releaseYear: 2011 },
      overridden: ['title', 'releaseYear'],
    });
  });

  it('replaces the thumbnail with a custom cover', () => {
    const { item, overridden } = applyOverrides(inception, { imageUrl: customCover });
    expect(item.imageUrl).toBe(customCover);
    expect(item.thumbnailUrl).toBe(customCover);
    expect(overridden).toEqual(['imageUrl']);
  });
});
