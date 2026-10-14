import { describe, expect, it } from 'vitest';

import { collectionHref, deleteCollectionText, itemCountText, movedOrder } from './collection-view';

const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';
const collections = [{ id: 'funko' }, { id: 'lego' }, { id: 'coins' }];

describe('collectionHref', () => {
  it('links to the collection page', () => {
    expect(collectionHref(funkoId)).toBe(`/collections/${funkoId}`);
  });
});

describe('itemCountText', () => {
  it('uses the singular for one item', () => {
    expect(itemCountText(1)).toBe('1 item');
    expect(itemCountText(12)).toBe('12 items');
  });
});

describe('deleteCollectionText', () => {
  it('says how many items are deleted with the collection', () => {
    expect(deleteCollectionText(1)).toBe('Its 1 item is deleted with it. This cannot be undone.');
    expect(deleteCollectionText(12)).toBe(
      'Its 12 items are deleted with it. This cannot be undone.',
    );
    expect(deleteCollectionText(0)).toBe('It has no items. This cannot be undone.');
  });
});

describe('movedOrder', () => {
  it('moves the dragged collection to the place of the other', () => {
    expect(movedOrder(collections, 'coins', 'funko')).toEqual(['coins', 'funko', 'lego']);
    expect(movedOrder(collections, 'funko', 'lego')).toEqual(['lego', 'funko', 'coins']);
  });

  it('keeps the order for an unknown collection', () => {
    expect(movedOrder(collections, 'stamps', 'funko')).toEqual(['funko', 'lego', 'coins']);
  });
});
