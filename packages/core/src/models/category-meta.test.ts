import { describe, expect, it } from 'vitest';

import { CATEGORY_META, OWNERSHIP_META, categoryLabel, ownershipLabel } from './category-meta';
import { ITEM_CATEGORIES, OWNERSHIP_STATUSES } from './enums';

describe('CATEGORY_META / OWNERSHIP_META', () => {
  it('covers every category and ownership status', () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...ITEM_CATEGORIES].sort());
    expect(Object.keys(OWNERSHIP_META).sort()).toEqual([...OWNERSHIP_STATUSES].sort());
  });
});

describe('categoryLabel', () => {
  it('returns the singular label', () => {
    expect(categoryLabel('movie')).toBe('Movie');
    expect(categoryLabel('video_game')).toBe('Video Game');
  });

  it('returns the plural label when asked', () => {
    expect(categoryLabel('video_game', { plural: true })).toBe('Video Games');
    expect(categoryLabel('funko', { plural: true })).toBe('Funko Pops');
  });
});

describe('ownershipLabel', () => {
  it('returns the display label', () => {
    expect(ownershipLabel('owned')).toBe('Owned');
    expect(ownershipLabel('preordered')).toBe('Pre-ordered');
    expect(ownershipLabel('loaned_out')).toBe('Loaned out');
  });
});
