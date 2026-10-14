import { describe, expect, it } from 'vitest';

import { orderCollections } from './custom-collection-hooks';

import type { CustomCollection } from '@fanste/core';

const funko: CustomCollection = {
  id: '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d',
  name: 'Funko Pops',
  description: null,
  icon: 'box',
  sortOrder: 0,
  createdAt: '2026-10-14T12:00:00+00:00',
  updatedAt: '2026-10-14T12:00:00+00:00',
};
const lego: CustomCollection = {
  ...funko,
  id: '8e7d6c5b-4a39-4281-9706-f5e4d3c2b1a0',
  name: 'LEGO Sets',
  sortOrder: 1,
};
const coins: CustomCollection = {
  ...funko,
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Coins',
  sortOrder: 2,
};

describe('orderCollections', () => {
  it('puts the collections in the order of the ids and renumbers them', () => {
    expect(orderCollections([funko, lego, coins], [coins.id, funko.id, lego.id])).toEqual([
      { ...coins, sortOrder: 0 },
      { ...funko, sortOrder: 1 },
      { ...lego, sortOrder: 2 },
    ]);
  });

  it('keeps collections missing from the ids at the end', () => {
    expect(
      orderCollections([funko, lego, coins], [lego.id]).map((collection) => collection.name),
    ).toEqual(['LEGO Sets', 'Funko Pops', 'Coins']);
  });
});
