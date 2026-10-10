import { describe, expect, it } from 'vitest';

import { categoryClasses, ownershipClasses } from './category-style';

describe('categoryClasses', () => {
  it('returns the classes of the category accent', () => {
    expect(categoryClasses('video_game').soft).toContain('category-video-game');
    expect(categoryClasses('video_game').fallback).toContain('text-category-video-game');
    expect(categoryClasses('movie').soft).toBe('bg-category-movie/10 text-category-movie');
    expect(categoryClasses('board_game').solid).toBe('bg-category-board-game');
  });
});

describe('ownershipClasses', () => {
  it('returns the classes of the status tone', () => {
    expect(ownershipClasses('owned')).toEqual({
      soft: 'bg-success/10 text-success',
      dot: 'bg-success',
    });
    expect(ownershipClasses('sold').soft).toContain('muted');
  });
});
