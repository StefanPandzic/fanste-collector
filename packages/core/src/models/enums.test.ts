import { describe, expect, it } from 'vitest';

import { providerSupportsCategory } from './enums';

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
