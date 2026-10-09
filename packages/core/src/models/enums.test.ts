import { describe, expect, it } from 'vitest';

import { providerOfCategory, providerSupportsCategory } from './enums';

describe('providerOfCategory', () => {
  it('returns the external provider that serves the category', () => {
    expect(providerOfCategory('movie')).toBe('tmdb');
    expect(providerOfCategory('tv')).toBe('tmdb');
    expect(providerOfCategory('music')).toBe('discogs');
    expect(providerOfCategory('video_game')).toBe('igdb');
    expect(providerOfCategory('board_game')).toBe('bgg');
  });

  it('returns undefined for Funko Pops', () => {
    expect(providerOfCategory('funko')).toBeUndefined();
  });
});

describe('providerSupportsCategory', () => {
  it('allows the categories each external provider serves', () => {
    expect(providerSupportsCategory('tmdb', 'movie')).toBe(true);
    expect(providerSupportsCategory('tmdb', 'tv')).toBe(true);
    expect(providerSupportsCategory('discogs', 'music')).toBe(true);
    expect(providerSupportsCategory('igdb', 'video_game')).toBe(true);
    expect(providerSupportsCategory('bgg', 'board_game')).toBe(true);
  });

  it('rejects categories a provider does not serve', () => {
    expect(providerSupportsCategory('tmdb', 'music')).toBe(false);
    expect(providerSupportsCategory('discogs', 'movie')).toBe(false);
    expect(providerSupportsCategory('bgg', 'video_game')).toBe(false);
  });

  it('allows any category for custom items', () => {
    expect(providerSupportsCategory('custom', 'funko')).toBe(true);
    expect(providerSupportsCategory('custom', 'movie')).toBe(true);
  });
});
