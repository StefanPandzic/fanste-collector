import { describe, expect, it } from 'vitest';

import {
  cleanDetails,
  initialFormValues,
  prefillLabel,
  showsCopyDetails,
  showsDigitalStore,
  showsFileFormat,
  targetOf,
  toAddItemInput,
} from './add-item-form';

import type { AddItemFormValues, AddTarget } from './add-item-form';

const matrixTarget: AddTarget = { category: 'movie', provider: 'tmdb', externalId: 'movie:603' };

const formValues: AddItemFormValues = {
  ownership: 'owned',
  quantity: '1',
  acquiredAt: '',
  purchasePrice: '',
  estimatedValue: '',
  notes: '',
  format: 'Blu-ray',
  details: {},
};

describe('targetOf', () => {
  it('returns the provider item of a search result', () => {
    expect(targetOf({ ...matrixTarget, title: 'The Matrix' })).toEqual(matrixTarget);
  });

  it('returns undefined for a custom item', () => {
    expect(
      targetOf({ provider: 'custom', externalId: 'funko-1', category: 'funko', title: 'Batman' }),
    ).toBeUndefined();
  });
});

describe('prefillLabel', () => {
  it('names where the value came from', () => {
    expect(prefillLabel('provider', 'tmdb')).toBe('from TMDB');
    expect(prefillLabel('scan', 'tmdb')).toBe('from scan');
    expect(prefillLabel('defaults', 'tmdb')).toBe('last used');
  });
});

describe('initialFormValues', () => {
  it('starts an owned copy with the suggested medium and details', () => {
    expect(
      initialFormValues({
        format: '4K UHD Blu-ray',
        details: { resolution: '2160p' },
        choices: {},
        sources: {},
      }),
    ).toEqual({ ...formValues, format: '4K UHD Blu-ray', details: { resolution: '2160p' } });
  });
});

describe('showsCopyDetails', () => {
  it('shows details for copies the user has', () => {
    expect(showsCopyDetails('owned')).toBe(true);
    expect(showsCopyDetails('loaned_out')).toBe(true);
    expect(showsCopyDetails('wishlist')).toBe(false);
  });
});

describe('showsFileFormat', () => {
  it('shows the container only for a digital file', () => {
    expect(showsFileFormat('Digital file')).toBe(true);
    expect(showsFileFormat('Blu-ray')).toBe(false);
  });
});

describe('showsDigitalStore', () => {
  it('shows the store only for a digital store copy', () => {
    expect(showsDigitalStore('Digital store')).toBe(true);
    expect(showsDigitalStore('Digital file')).toBe(false);
  });
});

describe('cleanDetails', () => {
  it('drops blank text, empty lists and undefined values', () => {
    expect(
      cleanDetails({
        resolution: '2160p',
        edition: '  ',
        subtitleLanguages: [],
        region: undefined,
        discCount: 2,
      }),
    ).toEqual({ resolution: '2160p', discCount: 2 });
  });
});

describe('toAddItemInput', () => {
  it('converts a valid form into the add input', () => {
    expect(
      toAddItemInput(
        {
          ...formValues,
          purchasePrice: '19,99',
          details: { resolution: '1080p', fileFormat: 'MKV', edition: '' },
        },
        matrixTarget,
        'EUR',
      ),
    ).toEqual({
      ok: true,
      input: {
        ...matrixTarget,
        ownership: 'owned',
        quantity: 1,
        acquiredAt: null,
        purchasePrice: 19.99,
        estimatedValue: null,
        currency: 'EUR',
        notes: '',
        format: 'Blu-ray',
        details: { resolution: '1080p' },
        source: 'search',
      },
    });
  });

  it('keeps the container of a digital file and drops the details of a wishlist item', () => {
    const digital = toAddItemInput(
      { ...formValues, format: 'Digital file', details: { fileFormat: 'MKV' } },
      matrixTarget,
      'EUR',
    );
    expect(digital.ok && digital.input.details).toEqual({ fileFormat: 'MKV' });
    expect(digital.ok && digital.input.currency).toBe(null);

    const wishlist = toAddItemInput(
      { ...formValues, ownership: 'wishlist', details: { resolution: '2160p' } },
      matrixTarget,
      'EUR',
    );
    expect(wishlist.ok && wishlist.input.format).toBe(null);
    expect(wishlist.ok && wishlist.input).not.toHaveProperty('details');
  });

  it('returns field errors for invalid values', () => {
    expect(
      toAddItemInput(
        { ...formValues, quantity: '0', purchasePrice: '12.345' },
        matrixTarget,
        'EUR',
      ),
    ).toEqual({
      ok: false,
      errors: {
        quantity: 'Enter a whole number from 1 to 9999.',
        purchasePrice: 'Enter an amount of 0 or more, with at most two decimals.',
      },
    });
    expect(
      toAddItemInput({ ...formValues, details: { discCount: 0 } }, matrixTarget, 'EUR'),
    ).toEqual({
      ok: false,
      errors: { 'details.discCount': 'Enter a number of discs from 1 to 99.' },
    });
  });
});
