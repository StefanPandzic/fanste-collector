import { describe, expect, it } from 'vitest';

import {
  categoryCards,
  categoryValues,
  isEmptyCollection,
  monthBars,
  valueSummary,
} from './dashboard-view';

import type { CollectionStats, ItemCounts } from '@fanste/collection';

const none: ItemCounts = { items: 0, quantity: 0 };

const stats: CollectionStats = {
  totals: { items: 6, quantity: 7 },
  byCategory: {
    movie: { items: 3, quantity: 4 },
    tv: { items: 1, quantity: 1 },
    music: { items: 2, quantity: 2 },
    video_game: none,
    board_game: none,
    funko: none,
  },
  byOwnership: {
    owned: { items: 3, quantity: 4 },
    wishlist: { items: 2, quantity: 2 },
    preordered: none,
    loaned_out: { items: 1, quantity: 1 },
    sold: none,
  },
  inCollection: { items: 4, quantity: 5 },
  inCollectionByCategory: {
    movie: { items: 3, quantity: 4 },
    tv: { items: 1, quantity: 1 },
    music: none,
    video_game: none,
    board_game: none,
    funko: none,
  },
  estimatedValue: [
    { currency: 'USD', total: 60 },
    { currency: 'EUR', total: 45.5 },
  ],
  valueByCategory: {
    movie: [
      { currency: 'USD', total: 20 },
      { currency: 'EUR', total: 45.5 },
    ],
    tv: [{ currency: 'USD', total: 40 }],
    music: [],
    video_game: [],
    board_game: [],
    funko: [],
  },
  addedByMonth: [
    { month: '2026-09', items: 1 },
    { month: '2026-10', items: 4 },
  ],
};

describe('valueSummary', () => {
  it('splits the default currency from the other currencies', () => {
    expect(valueSummary(stats, 'EUR')).toEqual({
      main: { currency: 'EUR', total: 45.5 },
      others: [{ currency: 'USD', total: 60 }],
    });
  });

  it('shows zero in the default currency when nothing is valued in it', () => {
    expect(valueSummary(stats, 'GBP').main).toEqual({ currency: 'GBP', total: 0 });
  });
});

describe('categoryCards', () => {
  it('builds one card per category with its count and gallery link', () => {
    const cards = categoryCards(stats);
    expect(cards.map((card) => card.category)).toEqual([
      'movie',
      'tv',
      'music',
      'video_game',
      'board_game',
      'funko',
    ]);
    expect(cards[0]).toEqual({
      category: 'movie',
      label: 'Movies',
      count: 3,
      href: '/collection?category=movie&ownership=owned&ownership=loaned_out&ownership=preordered',
      available: true,
    });
  });

  it('marks categories without a provider or items as coming soon', () => {
    const cards = categoryCards(stats);
    expect(cards.find((card) => card.category === 'funko')?.available).toBe(false);
    expect(cards.find((card) => card.category === 'tv')?.available).toBe(true);
  });
});

describe('monthBars', () => {
  it('labels each month and scales the bars to the largest', () => {
    expect(monthBars(stats.addedByMonth, 'en-US')).toEqual([
      {
        key: '2026-09',
        label: 'Sep',
        description: 'September 2026: 1 item',
        value: 1,
        ratio: 0.25,
      },
      {
        key: '2026-10',
        label: 'Oct',
        description: 'October 2026: 4 items',
        value: 4,
        ratio: 1,
      },
    ]);
  });
});

describe('categoryValues', () => {
  it('lists the categories valued in the default currency, largest first', () => {
    expect(categoryValues(stats, 'USD')).toEqual([
      { category: 'tv', label: 'TV Shows', total: 40, ratio: 1 },
      { category: 'movie', label: 'Movies', total: 20, ratio: 0.5 },
    ]);
  });
});

describe('isEmptyCollection', () => {
  it('is true only when the user has no items at all', () => {
    expect(isEmptyCollection(stats)).toBe(false);
    expect(isEmptyCollection({ ...stats, totals: none })).toBe(true);
  });
});
