import { ITEM_CATEGORIES, OWNERSHIP_STATUSES } from '@fanste/core';

import type { ItemCardData } from '@/components/items/item-card';

export interface MockItem extends ItemCardData {
  id: string;
}

const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342';

// Real posters (from the TMDB fixtures) to show loading, one broken URL to show the fallback, and
// gaps without a cover. Only these few URLs are fetched, however many items there are.
const COVERS: readonly (string | undefined)[] = [
  `${TMDB_POSTER}/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg`,
  undefined,
  `${TMDB_POSTER}/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg`,
  `${TMDB_POSTER}/does-not-exist.jpg`,
  undefined,
  `${TMDB_POSTER}/dMXwKX2u98yuAXrslSRmteztMoE.jpg`,
];

const TITLES = [
  'Inception',
  'Breaking Bad',
  'Kind of Blue',
  'The Legend of Zelda: Breath of the Wild',
  'Wingspan',
  'Darth Vader #01',
  'A Title Long Enough to Need Truncating in a Narrow Card',
];

/** `count` deterministic items cycling through every category, ownership status and cover kind. */
export function mockItems(count: number): MockItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-${index}`,
    title: `${TITLES[index % TITLES.length]} ${index + 1}`,
    category: ITEM_CATEGORIES[index % ITEM_CATEGORIES.length] ?? 'movie',
    releaseYear: index % 9 === 0 ? undefined : 1970 + (index % 56),
    imageUrl: COVERS[index % COVERS.length],
    ownership: OWNERSHIP_STATUSES[index % OWNERSHIP_STATUSES.length],
  }));
}
