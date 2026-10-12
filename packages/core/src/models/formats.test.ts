import { describe, expect, it } from 'vitest';

import { FORMATS_BY_CATEGORY } from './formats';

describe('FORMATS_BY_CATEGORY', () => {
  it('offers the music media', () => {
    expect(FORMATS_BY_CATEGORY.music).toEqual(['Vinyl', 'CD', 'Cassette', 'Digital']);
    expect(FORMATS_BY_CATEGORY.movie).toContain('Blu-ray');
  });
});
