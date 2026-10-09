import { describe, expect, it } from 'vitest';

import { normalizedItemSchema } from './normalized-item';

const inception = {
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

describe('normalizedItemSchema', () => {
  it('accepts a TMDB movie', () => {
    expect(normalizedItemSchema.parse(inception)).toEqual(inception);
  });

  it('rejects a wrong provider/category pair and a malformed external ID', () => {
    const wrongCategory = normalizedItemSchema.safeParse({ ...inception, category: 'music' });
    expect(wrongCategory.success).toBe(false);
    expect(wrongCategory.error?.issues[0]?.path).toEqual(['category']);

    const wrongId = normalizedItemSchema.safeParse({ ...inception, externalId: 'tv:1396' });
    expect(wrongId.success).toBe(false);
    expect(wrongId.error?.issues[0]?.path).toEqual(['externalId']);
  });

  it('accepts any non-empty external ID for custom items', () => {
    const result = normalizedItemSchema.safeParse({
      provider: 'custom',
      externalId: '6f1c2a8e-3b4d-4e5f-9a7b-1c2d3e4f5a6b',
      category: 'funko',
      title: 'Funko Pop! Walter White',
    });
    expect(result.success).toBe(true);
  });
});
