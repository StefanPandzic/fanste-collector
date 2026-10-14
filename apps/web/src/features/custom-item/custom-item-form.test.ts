import { describe, expect, it } from 'vitest';

import {
  customItemFieldValues,
  EMPTY_CUSTOM_ITEM_FIELDS,
  initialCustomItemForm,
  parseCreators,
  toAddCustomItemInput,
  toCustomItemDataPatch,
} from './custom-item-form';

import type { CustomItemFormValues, CustomItemTarget } from './custom-item-form';

const funkoTarget: CustomItemTarget = {
  category: 'custom',
  customCollectionId: '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d',
};

const spiderManForm: CustomItemFormValues = {
  ...initialCustomItemForm('Physical'),
  item: {
    ...EMPTY_CUSTOM_ITEM_FIELDS,
    title: ' Spider-Man ',
    identifier: '#123',
    releaseYear: '2017',
    creators: 'Funko, ',
  },
  details: { condition: 'Mint' },
};

describe('customItemFieldValues', () => {
  it('turns stored data into form values', () => {
    expect(
      customItemFieldValues({
        title: 'Millennium Falcon',
        identifier: '75192',
        releaseYear: 2017,
        creators: ['LEGO', 'Hasbro'],
      }),
    ).toEqual({
      ...EMPTY_CUSTOM_ITEM_FIELDS,
      title: 'Millennium Falcon',
      identifier: '75192',
      releaseYear: '2017',
      creators: 'LEGO, Hasbro',
    });
    expect(customItemFieldValues(null)).toEqual(EMPTY_CUSTOM_ITEM_FIELDS);
  });
});

describe('parseCreators', () => {
  it('splits names on commas and drops blank ones', () => {
    expect(parseCreators(' Hasbro, Funko ,, ')).toEqual(['Hasbro', 'Funko']);
  });
});

describe('toCustomItemDataPatch', () => {
  it('sets changed fields and removes emptied ones', () => {
    expect(
      toCustomItemDataPatch({ title: 'Iron Man', subtitle: '  ', releaseYear: '2019' }),
    ).toEqual({ patch: { title: 'Iron Man', subtitle: null, releaseYear: 2019 }, errors: {} });
  });

  it('reports an emptied title and a bad year', () => {
    const { errors } = toCustomItemDataPatch({ title: '', releaseYear: 'soon' });
    expect(Object.keys(errors)).toEqual(['item.title', 'item.releaseYear']);
  });
});

describe('toAddCustomItemInput', () => {
  it('builds the input of an item in a custom collection', () => {
    expect(toAddCustomItemInput(spiderManForm, funkoTarget, 'EUR')).toEqual({
      ok: true,
      input: {
        category: 'custom',
        customCollectionId: funkoTarget.customCollectionId,
        customData: {
          title: 'Spider-Man',
          identifier: '#123',
          releaseYear: 2017,
          creators: ['Funko'],
        },
        ownership: 'owned',
        quantity: 1,
        acquiredAt: null,
        purchasePrice: null,
        estimatedValue: null,
        currency: null,
        notes: '',
        format: 'Physical',
        details: { condition: 'Mint' },
      },
    });
  });

  it('reports a missing title on the title field', () => {
    const result = toAddCustomItemInput(
      { ...spiderManForm, item: { ...spiderManForm.item, title: '  ' } },
      funkoTarget,
      'EUR',
    );
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(['errors', 'item.title']);
  });

  it('saves no format or details for a wishlist item', () => {
    const result = toAddCustomItemInput(
      { ...spiderManForm, ownership: 'wishlist' },
      funkoTarget,
      'EUR',
    );
    expect(result).toHaveProperty(['input', 'format'], null);
    expect(result).not.toHaveProperty(['input', 'details']);
  });
});
