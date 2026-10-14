import { describe, expect, it } from 'vitest';

import { FORMATS_BY_CATEGORY, POPULAR_GAME_PLATFORMS } from './formats';

describe('FORMATS_BY_CATEGORY', () => {
  it('offers the music media', () => {
    expect(FORMATS_BY_CATEGORY.music).toEqual(['Vinyl', 'CD', 'Cassette', 'Digital']);
    expect(FORMATS_BY_CATEGORY.movie).toContain('Blu-ray');
  });

  it('offers the video game media', () => {
    expect(FORMATS_BY_CATEGORY.video_game).toEqual([
      'Disc',
      'Cartridge',
      'Digital',
      'Digital code',
    ]);
  });
});

describe('POPULAR_GAME_PLATFORMS', () => {
  it('lists the popular platforms by IGDB ID', () => {
    expect(POPULAR_GAME_PLATFORMS.map((platform) => platform.id)).toEqual([
      6, 167, 48, 169, 49, 508, 130,
    ]);
    expect(POPULAR_GAME_PLATFORMS).toContainEqual({ id: 167, name: 'PlayStation 5', label: 'PS5' });
  });
});
