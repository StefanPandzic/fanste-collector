import { describe, expect, it } from 'vitest';

import { columnsFor, formatSeasons } from './columns';

import type { ItemCategory } from '@fanste/core';

function headersFor(categories: ItemCategory[], includeOriginal = false): string[] {
  return columnsFor(new Set(categories), { includeOriginal }).map((column) => column.header);
}

describe('columnsFor', () => {
  it('gives a movie-only export just the shared and movie columns', () => {
    const headers = headersFor(['movie']);
    expect(headers).toContain('Title');
    expect(headers).toContain('Resolution');
    expect(headers).toContain('Edition');
    expect(headers).not.toContain('Vinyl size');
    expect(headers).not.toContain('Platform');
    expect(headers).not.toContain('Collection');
    expect(headers).not.toContain('Condition');
    expect(headers).not.toContain('Original title');
  });

  it('adds the custom collection columns for custom items', () => {
    const headers = headersFor(['custom']);
    expect(headers).toContain('Collection');
    expect(headers).toContain('Number / code');
    expect(headers).toContain('Condition');
    expect(headers).toContain('Boxed');
    expect(headers).not.toContain('Resolution');
  });

  it('adds the original values with includeOriginal', () => {
    expect(headersFor(['movie'], true).slice(-3)).toEqual([
      'Original title',
      'Original subtitle',
      'Original year',
    ]);
  });
});

describe('formatSeasons', () => {
  it('lists the owned episodes of each season as ranges', () => {
    expect(
      formatSeasons([
        { seasonNumber: 0, episodesOwned: 'all' },
        { seasonNumber: 1, episodesOwned: 'all' },
        { seasonNumber: 2, episodesOwned: [1, 2, 3, 4, 6] },
      ]),
    ).toBe('Specials: all; S1: all; S2: 1-4, 6');
  });
});
