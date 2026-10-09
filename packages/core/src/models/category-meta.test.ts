import { describe, expect, it } from 'vitest';

import {
  CATEGORY_META,
  OWNERSHIP_META,
  PROVIDER_LABELS,
  categoryLabel,
  ownershipLabel,
  providerLabel,
} from './category-meta';
import { ITEM_CATEGORIES, METADATA_PROVIDERS, OWNERSHIP_STATUSES } from './enums';

describe('CATEGORY_META / OWNERSHIP_META / PROVIDER_LABELS', () => {
  it('covers every category, ownership status and provider', () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...ITEM_CATEGORIES].sort());
    expect(Object.keys(OWNERSHIP_META).sort()).toEqual([...OWNERSHIP_STATUSES].sort());
    expect(Object.keys(PROVIDER_LABELS).sort()).toEqual([...METADATA_PROVIDERS].sort());
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

describe('providerLabel', () => {
  it('returns the display name', () => {
    expect(providerLabel('tmdb')).toBe('TMDB');
    expect(providerLabel('bgg')).toBe('BoardGameGeek');
  });
});
